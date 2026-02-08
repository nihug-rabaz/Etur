import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ensureTaskHierarchySchema } from "@/lib/ensure-schema";
import { canUserSeeTask } from "@/lib/visibility";

export async function PATCH(
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
    const body = await req.json();
    const { status, ...otherFields } = body;

    const userRole = session.user.role || "חפ״ש";
    const userId = session.user.id;

    const canSee = await canUserSeeTask(sql, userId, userRole, id);
    if (!canSee) {
      return NextResponse.json({ error: "Task not found or access denied" }, { status: 404 });
    }

    const task = await sql`
      SELECT "leaderId", "isGeneral", section, topic
      FROM "task"
      WHERE id = ${id}
    `;

    if (task.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const taskData = task[0];

    // For non-status updates, only team leads/managers can edit
    if (Object.keys(otherFields).length > 0) {
      if (userRole !== "מפקד צוות" && userRole !== "מנהל") {
        return NextResponse.json(
          { error: "Only team leads and managers can edit task details" },
          { status: 403 },
        );
      }
    }

    // For status updates, allow if user is leader, collaborator, or team lead/manager
    if (status) {
      if (!["pending", "in-progress", "completed"].includes(status)) {
        return NextResponse.json(
          { error: "Status must be pending, in-progress, or completed" },
          { status: 400 },
        );
      }

      // Check if user is leader or collaborator
      const isLeader = taskData.leaderId === userId;
      const isCollaborator = await sql`
        SELECT 1 FROM "taskUser" WHERE "taskId" = ${id} AND "userId" = ${userId}
      `;

      if (!isLeader && isCollaborator.length === 0 && userRole !== "מפקד צוות" && userRole !== "מנהל") {
        return NextResponse.json(
          { error: "You can only update status of tasks assigned to you" },
          { status: 403 },
        );
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    if (status) {
      updates.push(`status = $${values.length + 1}`);
      values.push(status);
    }
    for (const [key, value] of Object.entries(otherFields)) {
      if (key === "parentTaskId" || key === "isGeneral" || key === "section" || key === "topic" || key === "domain" || key === "priority" || key === "title" || key === "description") {
        updates.push(`"${key}" = $${values.length + 1}`);
        values.push(value);
      }
    }
    updates.push(`"updatedAt" = NOW()`);

    if (updates.length > 1) {
      const query = `UPDATE "task" SET ${updates.join(", ")} WHERE id = $${values.length + 1}`;
      await sql(query, [...values, id]);
    }

    return NextResponse.json(
      { message: "Task updated successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Update task status error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureTaskHierarchySchema(sql);

    const userRole = session.user.role || "חפ״ש";
    const userId = session.user.id;
    
    // Only team leads and managers can delete tasks
    if (userRole !== "מפקד צוות" && userRole !== "מנהל") {
      return NextResponse.json(
        { error: "Only team leads and managers can delete tasks" },
        { status: 403 },
      );
    }

    const { id } = await params;

    const canSee = await canUserSeeTask(sql, userId, userRole, id);
    if (!canSee) {
      return NextResponse.json({ error: "Task not found or access denied" }, { status: 404 });
    }

    await sql`DELETE FROM "task" WHERE id = ${id}`;

    return NextResponse.json(
      { message: "Task deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
