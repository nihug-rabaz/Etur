import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ensureTaskHierarchySchema } from "@/lib/ensure-schema";
import { isValidSection, isValidTopic, TOPICS_BY_SECTION } from "@/lib/topics";

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

    const userRole = session.user.role || "חפ״ש";
    // Only managers can view user topics
    if (userRole !== "מנהל") {
      return NextResponse.json(
        { error: "Only managers can view user topics" },
        { status: 403 },
      );
    }

    const { id } = await params;

    const userTopics = await sql`
      SELECT section, topic
      FROM "userTopic"
      WHERE "userId" = ${id}
      ORDER BY section, topic
    `;

    return NextResponse.json({ userTopics }, { status: 200 });
  } catch (error) {
    console.error("Get user topics error:", error);
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

    const userRole = session.user.role || "חפ״ש";
    // Only managers can assign user topics
    if (userRole !== "מנהל") {
      return NextResponse.json(
        { error: "Only managers can assign user topics" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { section, topic } = body;

    if (!section || !topic) {
      return NextResponse.json(
        { error: "Section and topic are required" },
        { status: 400 },
      );
    }

    if (!isValidSection(section)) {
      return NextResponse.json(
        { error: `Section must be one of: ${Object.keys(TOPICS_BY_SECTION).join(", ")}` },
        { status: 400 },
      );
    }

    if (!isValidTopic(section, topic)) {
      return NextResponse.json(
        { error: `Topic must be one of: ${TOPICS_BY_SECTION[section].join(", ")}` },
        { status: 400 },
      );
    }

    // Verify user exists
    const user = await sql`
      SELECT id FROM "user" WHERE id = ${id}
    `;

    if (user.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await sql`
      INSERT INTO "userTopic" ("userId", section, topic)
      VALUES (${id}, ${section}, ${topic})
      ON CONFLICT DO NOTHING
    `;

    return NextResponse.json(
      { message: "User topic assigned successfully" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Assign user topic error:", error);
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
    // Only managers can remove user topics
    if (userRole !== "מנהל") {
      return NextResponse.json(
        { error: "Only managers can remove user topics" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section");
    const topic = searchParams.get("topic");

    if (!section || !topic) {
      return NextResponse.json(
        { error: "Section and topic query parameters are required" },
        { status: 400 },
      );
    }

    await sql`
      DELETE FROM "userTopic"
      WHERE "userId" = ${id} AND section = ${section} AND topic = ${topic}
    `;

    return NextResponse.json(
      { message: "User topic removed successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Remove user topic error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
