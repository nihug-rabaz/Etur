import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ensureTaskHierarchySchema } from "@/lib/ensure-schema";
import { isValidSection, isValidTopic, TOPICS_BY_SECTION } from "@/lib/topics";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureTaskHierarchySchema(sql);

    const userId = session.user.id;
    const userRole = session.user.role || "חפ״ש";

    // Managers see all parent tasks; others see filtered by userTopics
    let parentTasksQuery;
    if (userRole === "מנהל") {
      parentTasksQuery = sql`
        SELECT 
          pt.id,
          pt.section,
          pt.domain,
          pt.title,
          pt.topic,
          pt.priority,
          pt."createdByUserId",
          pt."createdAt",
          pt."updatedAt",
          u.name as createdBy_name,
          u.email as createdBy_email
        FROM "parentTask" pt
        LEFT JOIN "user" u ON pt."createdByUserId" = u.id
        ORDER BY pt."createdAt" DESC
      `;
    } else {
      // Get user's topics
      const userTopics = await sql`
        SELECT section, topic FROM "userTopic" WHERE "userId" = ${userId}
      `;

      if (userTopics.length === 0) {
        // No topics: return empty
        return NextResponse.json({ parentTasks: [] }, { status: 200 });
      }

      // Filter by userTopics
      parentTasksQuery = sql`
        SELECT DISTINCT
          pt.id,
          pt.section,
          pt.domain,
          pt.title,
          pt.topic,
          pt.priority,
          pt."createdByUserId",
          pt."createdAt",
          pt."updatedAt",
          u.name as createdBy_name,
          u.email as createdBy_email
        FROM "parentTask" pt
        LEFT JOIN "user" u ON pt."createdByUserId" = u.id
        LEFT JOIN "userTopic" ut ON pt.section = ut.section AND pt.topic = ut.topic AND ut."userId" = ${userId}
        WHERE ut."userId" IS NOT NULL
        ORDER BY pt."createdAt" DESC
      `;
    }

    const parentTasksResult = await parentTasksQuery;

    // Enrich with discussion indicators
    const parentTasksWithDiscussion = await Promise.all(
      parentTasksResult.map(async (pt) => {
        const discussionCount = await sql`
          SELECT COUNT(*) as count
          FROM "discussionMessage"
          WHERE "entityType" = 'parentTask' AND "entityId" = ${pt.id}
        `;

        const lastRead = await sql`
          SELECT "lastReadAt"
          FROM "discussionReadState"
          WHERE "userId" = ${userId} AND "entityType" = 'parentTask' AND "entityId" = ${pt.id}
        `;

        const lastReadAt = lastRead[0]?.lastReadAt;
        const hasUnread = lastReadAt
          ? await sql`
              SELECT COUNT(*) > 0 as has_unread
              FROM "discussionMessage"
              WHERE "entityType" = 'parentTask' AND "entityId" = ${pt.id}
                AND "createdAt" > ${lastReadAt}
            `
          : [{ has_unread: discussionCount[0]?.count > 0 }];

        return {
          ...pt,
          discussionCount: Number(discussionCount[0]?.count || 0),
          hasUnreadDiscussion: hasUnread[0]?.has_unread || false,
        };
      }),
    );

    return NextResponse.json(
      { parentTasks: parentTasksWithDiscussion },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error("Get parent tasks error:", error);
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
    // Only team leads and managers can create parent tasks
    if (userRole !== "מפקד צוות" && userRole !== "מנהל") {
      return NextResponse.json(
        { error: "Only team leads and managers can create parent tasks" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { section, domain, title, topic, priority } = body;

    if (!section || !domain || !title || !topic) {
      return NextResponse.json(
        { error: "Section, domain, title, and topic are required" },
        { status: 400 },
      );
    }

    if (!isValidSection(section)) {
      return NextResponse.json(
        { error: `Section must be one of: ${TOPICS_BY_SECTION.keys().join(", ")}` },
        { status: 400 },
      );
    }

    if (!isValidTopic(section, topic)) {
      return NextResponse.json(
        { error: `Topic must be one of: ${TOPICS_BY_SECTION[section].join(", ")}` },
        { status: 400 },
      );
    }

    if (priority && !["low", "medium", "high"].includes(priority)) {
      return NextResponse.json(
        { error: "Priority must be low, medium, or high" },
        { status: 400 },
      );
    }

    const parentTaskId = crypto.randomUUID();
    const userId = session.user.id;

    await sql`
      INSERT INTO "parentTask" (
        id, section, domain, title, topic, priority, "createdByUserId"
      )
      VALUES (
        ${parentTaskId},
        ${section},
        ${domain},
        ${title},
        ${topic},
        ${priority || "medium"},
        ${userId}
      )
    `;

    const newParentTask = await sql`
      SELECT 
        pt.*,
        u.name as createdBy_name,
        u.email as createdBy_email
      FROM "parentTask" pt
      LEFT JOIN "user" u ON pt."createdByUserId" = u.id
      WHERE pt.id = ${parentTaskId}
    `;

    return NextResponse.json(
      { message: "Parent task created successfully", parentTask: newParentTask[0] },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create parent task error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
