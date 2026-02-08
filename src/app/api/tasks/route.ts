import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ensureTaskHierarchySchema } from "@/lib/ensure-schema";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureTaskHierarchySchema(sql);

    const userId = session.user.id;
    const userRole = session.user.role || "חפ״ש";

    // Managers see all tasks; others see filtered by userTopics or general tasks assigned to them
    let tasksQuery;
    if (userRole === "מנהל") {
      tasksQuery = sql`
        SELECT 
          t.id,
          t.title,
          t.description,
          t."parentTaskId",
          t."isGeneral",
          t.section,
          t.domain,
          t.topic,
          t."leaderId",
          t."dueDate",
          t.priority,
          t.status,
          t."createdAt",
          pt.title as parent_title,
          u.name as leader_name,
          u.email as leader_email
        FROM "task" t
        LEFT JOIN "user" u ON t."leaderId" = u.id
        LEFT JOIN "parentTask" pt ON t."parentTaskId" = pt.id
        ORDER BY t."createdAt" DESC
      `;
    } else {
      // Get user's topics
      const userTopics = await sql`
        SELECT section, topic FROM "userTopic" WHERE "userId" = ${userId}
      `;

      // Build visibility filter: general tasks assigned to user OR tasks matching userTopics
      if (userTopics.length === 0) {
        // No topics assigned: only general tasks assigned to user
        tasksQuery = sql`
          SELECT 
            t.id,
            t.title,
            t.description,
            t."parentTaskId",
            t."isGeneral",
            t.section,
            t.domain,
            t.topic,
            t."leaderId",
            t."dueDate",
            t.priority,
            t.status,
            t."createdAt",
            pt.title as parent_title,
            u.name as leader_name,
            u.email as leader_email
          FROM "task" t
          LEFT JOIN "user" u ON t."leaderId" = u.id
          LEFT JOIN "parentTask" pt ON t."parentTaskId" = pt.id
          LEFT JOIN "taskUser" tu ON t.id = tu."taskId"
          WHERE t."isGeneral" = true
            AND (t."leaderId" = ${userId} OR tu."userId" = ${userId})
          ORDER BY t."createdAt" DESC
        `;
      } else {
        // Has topics: general tasks assigned to user OR tasks matching topics
        // Build topic pairs for IN clause
        const topicPairs = userTopics.map((ut) => [ut.section, ut.topic]);
        tasksQuery = sql`
          SELECT DISTINCT
            t.id,
            t.title,
            t.description,
            t."parentTaskId",
            t."isGeneral",
            t.section,
            t.domain,
            t.topic,
            t."leaderId",
            t."dueDate",
            t.priority,
            t.status,
            t."createdAt",
            pt.title as parent_title,
            u.name as leader_name,
            u.email as leader_email
          FROM "task" t
          LEFT JOIN "user" u ON t."leaderId" = u.id
          LEFT JOIN "parentTask" pt ON t."parentTaskId" = pt.id
          LEFT JOIN "taskUser" tu ON t.id = tu."taskId"
          LEFT JOIN "userTopic" ut ON t.section = ut.section AND t.topic = ut.topic AND ut."userId" = ${userId}
          WHERE (
            t."isGeneral" = true AND (t."leaderId" = ${userId} OR tu."userId" = ${userId})
          ) OR (
            t."isGeneral" = false AND ut."userId" IS NOT NULL
          )
          ORDER BY t."createdAt" DESC
        `;
      }
    }

    const tasksResult = await tasksQuery;

    // Enrich with collaborators and discussion indicators
    const tasksWithCollaborators = await Promise.all(
      tasksResult.map(async (task) => {
        const collaborators = await sql`
          SELECT 
            u.id,
            u.name,
            u.email,
            tu.role
          FROM "taskUser" tu
          LEFT JOIN "user" u ON tu."userId" = u.id
          WHERE tu."taskId" = ${task.id}
        `;

        // Discussion count
        const discussionCount = await sql`
          SELECT COUNT(*) as count
          FROM "discussionMessage"
          WHERE "entityType" = 'task' AND "entityId" = ${task.id}
        `;

        // Check if user has unread messages
        const lastRead = await sql`
          SELECT "lastReadAt"
          FROM "discussionReadState"
          WHERE "userId" = ${userId} AND "entityType" = 'task' AND "entityId" = ${task.id}
        `;

        const lastReadAt = lastRead[0]?.lastReadAt;
        const hasUnread = lastReadAt
          ? await sql`
              SELECT COUNT(*) > 0 as has_unread
              FROM "discussionMessage"
              WHERE "entityType" = 'task' AND "entityId" = ${task.id}
                AND "createdAt" > ${lastReadAt}
            `
          : [{ has_unread: discussionCount[0]?.count > 0 }];

        return {
          ...task,
          parentTitle: task.parent_title || null,
          collaborators: collaborators || [],
          discussionCount: Number(discussionCount[0]?.count || 0),
          hasUnreadDiscussion: hasUnread[0]?.has_unread || false,
        };
      }),
    );

    return NextResponse.json(
      { tasks: tasksWithCollaborators },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error("Get tasks error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureTaskHierarchySchema(sql);

    const userRole = session.user.role || "חפ״ש";
    // Only team lead ("מפקד צוות") or manager ("מנהל") can create tasks
    if (userRole !== "מפקד צוות" && userRole !== "מנהל") {
      return NextResponse.json(
        { error: "Only team leads and managers can create tasks" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      domain,
      topic,
      leaderId,
      dueDate,
      priority,
      collaboratorIds,
      parentTaskId,
      isGeneral,
      section,
    } = body;

    if (!title || !domain || !leaderId) {
      return NextResponse.json(
        { error: "Title, domain, and leader are required" },
        { status: 400 },
      );
    }

    // For child tasks, topic is required (inherited from parent or explicit)
    // For general tasks, topic is optional
    if (!isGeneral && !topic && !parentTaskId) {
      return NextResponse.json(
        { error: "Topic is required for child tasks without a parent" },
        { status: 400 },
      );
    }

    // For general tasks, if section is not provided, set a default or allow null
    // For child tasks, section will be inherited from parent if not provided

    if (priority && !["low", "medium", "high"].includes(priority)) {
      return NextResponse.json(
        { error: "Priority must be low, medium, or high" },
        { status: 400 },
      );
    }

    // If parentTaskId is provided, inherit section/topic from parent
    let finalSection = section;
    let finalTopic = topic;
    let finalDomain = domain;
    if (parentTaskId) {
      const parent = await sql`
        SELECT section, topic, domain FROM "parentTask" WHERE id = ${parentTaskId}
      `;
      if (parent.length === 0) {
        return NextResponse.json(
          { error: "Parent task not found" },
          { status: 404 },
        );
      }
      finalSection = parent[0].section;
      finalTopic = parent[0].topic;
      if (!finalDomain) {
        finalDomain = parent[0].domain;
      }
    }

    const taskId = crypto.randomUUID();

    await sql`
      INSERT INTO "task" (
        id, title, description, domain, topic, "leaderId", "dueDate", priority, status,
        "parentTaskId", "isGeneral", section
      )
      VALUES (
        ${taskId},
        ${title},
        ${description || null},
        ${finalDomain},
        ${finalTopic || null},
        ${leaderId},
        ${dueDate ? new Date(dueDate) : null},
        ${priority || "medium"},
        'pending',
        ${parentTaskId || null},
        ${isGeneral || false},
        ${finalSection || null}
      )
    `;

    if (
      collaboratorIds &&
      Array.isArray(collaboratorIds) &&
      collaboratorIds.length > 0
    ) {
      for (const userId of collaboratorIds) {
        await sql`
          INSERT INTO "taskUser" ("taskId", "userId", role)
          VALUES (${taskId}, ${userId}, 'collaborator')
          ON CONFLICT DO NOTHING
        `;
      }
    }

    const newTask = await sql`
      SELECT 
        t.*,
        pt.title as parent_title,
        u.name as leader_name,
        u.email as leader_email
      FROM "task" t
      LEFT JOIN "user" u ON t."leaderId" = u.id
      LEFT JOIN "parentTask" pt ON t."parentTaskId" = pt.id
      WHERE t.id = ${taskId}
    `;

    return NextResponse.json(
      { message: "Task created successfully", task: { ...newTask[0], parentTitle: newTask[0].parent_title || null } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
