import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    try {
      await sql`
        INSERT INTO "taskUser" ("taskId", "userId", role)
        VALUES (${id}, ${userId}, 'collaborator')
        ON CONFLICT ("taskId", "userId") DO NOTHING
      `;
    } catch (insertError: any) {
      if (insertError?.code === "42P10") {
        try {
          await sql`
            INSERT INTO "taskUser" ("taskId", "userId", role)
            VALUES (${id}, ${userId}, 'collaborator')
            ON CONFLICT ON CONSTRAINT "taskUser_taskId_userId_pk" DO NOTHING
          `;
        } catch (constraintError: any) {
          await sql`
            INSERT INTO "taskUser" ("taskId", "userId", role)
            VALUES (${id}, ${userId}, 'collaborator')
            ON CONFLICT DO NOTHING
          `;
        }
      } else {
        throw insertError;
      }
    }

    const collaborator = await sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        tu.role
      FROM "taskUser" tu
      LEFT JOIN "user" u ON tu."userId" = u.id
      WHERE tu."taskId" = ${id} AND tu."userId" = ${userId}
    `;

    if (!collaborator || collaborator.length === 0) {
      return NextResponse.json(
        { error: "Collaborator not found after insertion" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Collaborator added successfully", collaborator: collaborator[0] },
      { status: 200 },
    );
  } catch (error) {
    console.error("Add collaborator error:", error);
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

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    await sql`
      DELETE FROM "taskUser"
      WHERE "taskId" = ${id} AND "userId" = ${userId}
    `;

    return NextResponse.json(
      { message: "Collaborator removed successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Remove collaborator error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
