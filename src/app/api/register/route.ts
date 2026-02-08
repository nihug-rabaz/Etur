import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/db";

async function ensurePasswordColumn() {
  try {
    await sql`SELECT password FROM "user" LIMIT 1`;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("column") && errorMsg.includes("password")) {
      try {
        await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "password" text`;
        const existingNulls =
          await sql`SELECT COUNT(*)::int as count FROM "user" WHERE "password" IS NULL`;
        if (
          existingNulls &&
          existingNulls.length > 0 &&
          Number(existingNulls[0]?.count) === 0
        ) {
          await sql`UPDATE "user" SET "password" = '' WHERE "password" IS NULL`;
          await sql`ALTER TABLE "user" ALTER COLUMN "password" SET NOT NULL`;
        }
      } catch (migrationError) {
        console.error("Migration error:", migrationError);
        throw migrationError;
      }
    } else if (errorMsg.includes("relation") && errorMsg.includes("user")) {
      console.error(
        "Table 'user' does not exist. Please run migrations first.",
      );
      throw new Error(
        "Database table 'user' does not exist. Please run migrations: npx drizzle-kit push",
      );
    } else {
      throw error;
    }
  }
}

async function ensureRoleColumn() {
  try {
    await sql`SELECT role FROM "user" LIMIT 1`;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("column") && errorMsg.includes("role")) {
      try {
        await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'חפ״ש'`;
        await sql`UPDATE "user" SET "role" = 'חפ״ש' WHERE "role" IS NULL`;
      } catch (migrationError) {
        console.error("Role column migration error:", migrationError);
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "Database connection not configured" },
        { status: 500 },
      );
    }

    await ensurePasswordColumn();
    await ensureRoleColumn();

    const body = await req.json();
    const { email, password, name, role } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const existingUserResult = await sql`
      SELECT id, email FROM "user" WHERE email = ${email} LIMIT 1
    `;

    if (existingUserResult && existingUserResult.length > 0) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    const newUser = await sql`
      INSERT INTO "user" (id, email, password, name, "isActive", role)
      VALUES (${userId}, ${email}, ${hashedPassword}, ${name || null}, false, 'חפ״ש')
      RETURNING id, email
    `;

    if (!newUser || newUser.length === 0) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: "User created successfully",
        user: { id: newUser[0].id, email: newUser[0].email },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("Error details:", {
      message: errorMessage,
      stack: errorStack,
    });

    return NextResponse.json(
      {
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 },
    );
  }
}
