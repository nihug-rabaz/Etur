import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

async function ensurePinnedTasksTable() {
  try {
    await sql`SELECT 1 FROM "userPinnedTask" LIMIT 1`;
    
    try {
      await sql`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'userPinnedTask' 
        AND constraint_type = 'PRIMARY KEY'
      `;
    } catch (pkCheckError) {
      console.log("Primary key not found, adding it...");
      try {
        await sql`
          ALTER TABLE "userPinnedTask" 
          ADD CONSTRAINT "userPinnedTask_userId_taskId_pk" 
          PRIMARY KEY ("userId", "taskId")
        `;
        console.log("Primary key constraint added");
      } catch (pkError: any) {
        if (pkError?.code !== "42P16" && !pkError?.message?.includes("already exists")) {
          console.error("Failed to add primary key:", pkError);
        }
      }
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.code;
    console.log("Table check error:", { errorMsg, errorCode });
    
    if (errorMsg.includes("does not exist") || errorCode === "42P01") {
      try {
        console.log("Creating userPinnedTask table...");
        await sql`
          CREATE TABLE IF NOT EXISTS "userPinnedTask" (
            "userId" text NOT NULL,
            "taskId" text NOT NULL
          )
        `;
        console.log("Table created, adding constraints...");
        
        try {
          await sql`
            ALTER TABLE "userPinnedTask" 
            ADD CONSTRAINT "userPinnedTask_userId_taskId_pk" 
            PRIMARY KEY ("userId", "taskId")
          `;
          console.log("Primary key constraint added");
        } catch (pkError: any) {
          if (pkError?.code !== "42P16" && !pkError?.message?.includes("already exists")) {
            console.error("Failed to add primary key:", pkError);
          }
        }
        
        try {
          await sql`
            ALTER TABLE "userPinnedTask" 
            ADD CONSTRAINT "userPinnedTask_userId_user_id_fk" 
            FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade
          `;
          console.log("User FK constraint added");
        } catch (constraintError: any) {
          if (constraintError?.code !== "42P16" && !constraintError?.message?.includes("already exists")) {
            console.log("User FK constraint may already exist, continuing...");
          }
        }
        
        try {
          await sql`
            ALTER TABLE "userPinnedTask" 
            ADD CONSTRAINT "userPinnedTask_taskId_task_id_fk" 
            FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE cascade
          `;
          console.log("Task FK constraint added");
        } catch (constraintError: any) {
          if (constraintError?.code !== "42P16" && !constraintError?.message?.includes("already exists")) {
            console.log("Task FK constraint may already exist, continuing...");
          }
        }
        
        console.log("Table setup completed");
      } catch (migrationError) {
        console.error("Migration error:", migrationError);
        throw migrationError;
      }
    } else {
      console.error("Unexpected error checking table:", error);
      throw error;
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePinnedTasksTable();

    const pinnedTasksResult = await sql`
      SELECT "taskId"
      FROM "userPinnedTask"
      WHERE "userId" = ${session.user.id}
    `;

    const taskIds = pinnedTasksResult.map((row: any) => row.taskId);

    return NextResponse.json({ taskIds }, { status: 200 });
  } catch (error) {
    console.error("Get pinned tasks error:", error);
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

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 },
      );
    }

    await ensurePinnedTasksTable();

    try {
      await sql`
        INSERT INTO "userPinnedTask" ("userId", "taskId")
        VALUES (${session.user.id}, ${taskId})
        ON CONFLICT ("userId", "taskId") DO NOTHING
      `;
    } catch (insertError: any) {
      if (insertError?.code === "42P10") {
        console.log("Primary key constraint missing, trying to add it and retry...");
        try {
          await sql`
            ALTER TABLE "userPinnedTask" 
            ADD CONSTRAINT "userPinnedTask_userId_taskId_pk" 
            PRIMARY KEY ("userId", "taskId")
          `;
          await sql`
            INSERT INTO "userPinnedTask" ("userId", "taskId")
            VALUES (${session.user.id}, ${taskId})
            ON CONFLICT ("userId", "taskId") DO NOTHING
          `;
        } catch (retryError: any) {
          console.error("Retry insert error details:", {
            code: retryError?.code,
            message: retryError?.message,
            detail: retryError?.detail,
          });
          throw retryError;
        }
      } else {
        console.error("Insert error details:", {
          code: insertError?.code,
          message: insertError?.message,
          detail: insertError?.detail,
        });
        throw insertError;
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Add pinned task error:", error);
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

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 },
      );
    }

    await ensurePinnedTasksTable();

    await sql`
      DELETE FROM "userPinnedTask"
      WHERE "userId" = ${session.user.id} AND "taskId" = ${taskId}
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Remove pinned task error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
