import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ensureTaskHierarchySchema } from "@/lib/ensure-schema";
import { canUserSeeParentTask } from "@/lib/visibility";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureTaskHierarchySchema(sql);

    const { id } = await params;
    const userId = session.user.id;
    const userRole = session.user.role || "חפ״ש";

    const canSee = await canUserSeeParentTask(sql, userId, userRole, id);
    if (!canSee) {
      return NextResponse.json({ error: "Parent task not found or access denied" }, { status: 404 });
    }

    // Get comments
    const comments = await sql`
      SELECT 
        dm.id,
        dm.content,
        dm."createdAt",
        u.id as user_id,
        u.name as user_name,
        u.email as user_email
      FROM "discussionMessage" dm
      LEFT JOIN "user" u ON dm."userId" = u.id
      WHERE dm."entityType" = 'parentTask' AND dm."entityId" = ${id}
      ORDER BY dm."createdAt" ASC
    `;

    // Mark as read
    await sql`
      INSERT INTO "discussionReadState" ("userId", "entityType", "entityId", "lastReadAt")
      VALUES (${userId}, 'parentTask', ${id}, NOW())
      ON CONFLICT ("userId", "entityType", "entityId")
      DO UPDATE SET "lastReadAt" = NOW()
    `;

    return NextResponse.json({ comments }, { status: 200 });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureTaskHierarchySchema(sql);

    const { id } = await params;
    const userId = session.user.id;
    const userRole = session.user.role || "חפ״ש";
    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const canSee = await canUserSeeParentTask(sql, userId, userRole, id);
    if (!canSee) {
      return NextResponse.json({ error: "Parent task not found or access denied" }, { status: 404 });
    }

    const commentId = crypto.randomUUID();

    try {
      await sql`
        INSERT INTO "discussionMessage" (id, "entityType", "entityId", "userId", content)
        VALUES (${commentId}, 'parentTask', ${id}, ${userId}, ${content.trim()})
      `;
    } catch (insertError) {
      console.error("Failed to insert comment:", insertError);
      return NextResponse.json(
        { error: "Failed to save comment. Please check if the discussionMessage table exists." },
        { status: 500 },
      );
    }

    // Get the created comment with user info
    const newComment = await sql`
      SELECT 
        dm.id,
        dm.content,
        dm."createdAt",
        u.id as user_id,
        u.name as user_name,
        u.email as user_email
      FROM "discussionMessage" dm
      LEFT JOIN "user" u ON dm."userId" = u.id
      WHERE dm.id = ${commentId}
    `;

    if (!newComment || newComment.length === 0) {
      console.error("Comment was inserted but could not be retrieved");
      return NextResponse.json(
        { error: "Comment was saved but could not be retrieved" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Comment added successfully", comment: newComment[0] },
      { status: 201 },
    );
  } catch (error) {
    console.error("Add comment error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
