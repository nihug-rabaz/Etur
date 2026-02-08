import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ensureTaskHierarchySchema } from "@/lib/ensure-schema";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureTaskHierarchySchema(sql);

    const userId = session.user.id;
    const userRole = session.user.role || "חפ״ש";

    // Get user's topics for visibility filtering
    const userTopics = await sql`
      SELECT section, topic FROM "userTopic" WHERE "userId" = ${userId}
    `;

    // Build query: tasks where user is leader/collaborator AND (general task OR matches userTopics)
    let tasksQuery;
    if (userRole === "מנהל") {
      // Managers see all tasks they're assigned to
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
        WHERE t."leaderId" = ${userId} OR tu."userId" = ${userId}
        ORDER BY t."createdAt" DESC
      `;
    } else if (userTopics.length === 0) {
      // No topics: only general tasks assigned to user
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
        WHERE (t."leaderId" = ${userId} OR tu."userId" = ${userId})
          AND t."isGeneral" = true
        ORDER BY t."createdAt" DESC
      `;
    } else {
      // Has topics: general tasks assigned to user OR tasks matching topics
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
        WHERE (t."leaderId" = ${userId} OR tu."userId" = ${userId})
          AND (
            (t."isGeneral" = true)
            OR (t."isGeneral" = false AND ut."userId" IS NOT NULL)
          )
        ORDER BY t."createdAt" DESC
      `;
    }

    const tasksResult = await tasksQuery;

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
    console.error("Get my tasks error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
