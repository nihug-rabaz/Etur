import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const domains = await sql`
      SELECT id, name
      FROM "domain"
      ORDER BY name ASC
    `;

    return NextResponse.json(
      { domains },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    console.error("Get domains error:", error);
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

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Domain name is required" },
        { status: 400 },
      );
    }

    const domainId = crypto.randomUUID();

    const newDomain = await sql`
      INSERT INTO "domain" (id, name)
      VALUES (${domainId}, ${name.trim()})
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `;

    return NextResponse.json(
      { message: "Domain created successfully", domain: newDomain[0] },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create domain error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Domain ID is required" },
        { status: 400 },
      );
    }

    const domainResult = await sql`
      SELECT name FROM "domain" WHERE id = ${id}
    `;

    if (!domainResult || domainResult.length === 0) {
      return NextResponse.json(
        { error: "Domain not found" },
        { status: 404 },
      );
    }

    const domainName = domainResult[0].name;

    const tasksWithDomain = await sql`
      SELECT COUNT(*)::int as count
      FROM "task"
      WHERE domain = ${domainName}
    `;

    if (tasksWithDomain && tasksWithDomain.length > 0 && tasksWithDomain[0]?.count > 0) {
      return NextResponse.json(
        {
          error: "לא ניתן למחוק תחום שיש בו משימות. יש למחוק או לשנות תחום של כל המשימות תחילה.",
        },
        { status: 400 },
      );
    }

    await sql`DELETE FROM "domain" WHERE id = ${id}`;

    return NextResponse.json(
      { message: "Domain deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Delete domain error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
