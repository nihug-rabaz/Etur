import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ensureTaskHierarchySchema } from "@/lib/ensure-schema";
import { isValidSection, isValidTopic, TOPICS_BY_SECTION } from "@/lib/topics";
import { canUserSeeParentTask } from "@/lib/visibility";

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

    const userRole = session.user.role || "חפ״ש";
    const userId = session.user.id;
    
    // Only team leads and managers can edit parent tasks
    if (userRole !== "מפקד צוות" && userRole !== "מנהל") {
      return NextResponse.json(
        { error: "Only team leads and managers can edit parent tasks" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { section, domain, title, topic, priority } = body;

    const canSee = await canUserSeeParentTask(sql, userId, userRole, id);
    if (!canSee) {
      return NextResponse.json({ error: "Parent task not found or access denied" }, { status: 404 });
    }

    const existing = await sql`
      SELECT * FROM "parentTask" WHERE id = ${id}
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
    }

    // Validate section and topic if provided
    if (section && !isValidSection(section)) {
      return NextResponse.json(
        { error: `Section must be one of: ${Object.keys(TOPICS_BY_SECTION).join(", ")}` },
        { status: 400 },
      );
    }

    const finalSection = section || existing[0].section;
    if (topic && !isValidTopic(finalSection, topic)) {
      return NextResponse.json(
        { error: `Topic must be one of: ${TOPICS_BY_SECTION[finalSection].join(", ")}` },
        { status: 400 },
      );
    }

    if (priority && !["low", "medium", "high"].includes(priority)) {
      return NextResponse.json(
        { error: "Priority must be low, medium, or high" },
        { status: 400 },
      );
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    if (section) {
      updates.push(`section = $${values.length + 1}`);
      values.push(section);
    }
    if (domain) {
      updates.push(`domain = $${values.length + 1}`);
      values.push(domain);
    }
    if (title) {
      updates.push(`title = $${values.length + 1}`);
      values.push(title);
    }
    if (topic) {
      updates.push(`topic = $${values.length + 1}`);
      values.push(topic);
    }
    if (priority) {
      updates.push(`priority = $${values.length + 1}`);
      values.push(priority);
    }
    updates.push(`"updatedAt" = NOW()`);

    if (updates.length > 1) {
      const query = `UPDATE "parentTask" SET ${updates.join(", ")} WHERE id = $${values.length + 1}`;
      await sql(query, [...values, id]);
    }

    return NextResponse.json(
      { message: "Parent task updated successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Update parent task error:", error);
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
    // Only managers can delete parent tasks
    if (userRole !== "מנהל") {
      return NextResponse.json(
        { error: "Only managers can delete parent tasks" },
        { status: 403 },
      );
    }

    const { id } = await params;

    await sql`DELETE FROM "parentTask" WHERE id = ${id}`;

    return NextResponse.json(
      { message: "Parent task deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Delete parent task error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
