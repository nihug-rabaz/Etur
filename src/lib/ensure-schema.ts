import type { NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Best-effort schema bootstrap for environments without migrations.
 * Keeps the app running by creating missing tables/columns.
 */
export async function ensureTaskHierarchySchema(sql: NeonQueryFunction<false, false>) {
  // 1) Parent tasks table
  await sql`
    CREATE TABLE IF NOT EXISTS "parentTask" (
      id text PRIMARY KEY,
      section text NOT NULL,
      domain text NOT NULL,
      title text NOT NULL,
      topic text NOT NULL,
      priority text NOT NULL DEFAULT 'medium',
      "createdByUserId" text NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    )
  `;

  // FK to user (best-effort)
  try {
    await sql`
      ALTER TABLE "parentTask"
      ADD CONSTRAINT parentTask_createdByUserId_fkey
      FOREIGN KEY ("createdByUserId") REFERENCES "user"(id) ON DELETE CASCADE
    `;
  } catch {
    // constraint exists or can't be created; ignore
  }

  // 2) Extend existing "task" table (child tasks + general tasks)
  await sql`ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "parentTaskId" text`;
  await sql`ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "isGeneral" boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "section" text`;

  // FK to parentTask (best-effort)
  try {
    await sql`
      ALTER TABLE "task"
      ADD CONSTRAINT task_parentTaskId_fkey
      FOREIGN KEY ("parentTaskId") REFERENCES "parentTask"(id) ON DELETE SET NULL
    `;
  } catch {
    // constraint exists or can't be created; ignore
  }

  // 3) User topics table
  await sql`
    CREATE TABLE IF NOT EXISTS "userTopic" (
      "userId" text NOT NULL,
      section text NOT NULL,
      topic text NOT NULL,
      PRIMARY KEY ("userId", section, topic)
    )
  `;

  try {
    await sql`
      ALTER TABLE "userTopic"
      ADD CONSTRAINT userTopic_userId_fkey
      FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE
    `;
  } catch {
    // ignore
  }

  // 4) Discussion tables
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "discussionMessage" (
        id text PRIMARY KEY,
        "entityType" text NOT NULL,
        "entityId" text NOT NULL,
        "userId" text NOT NULL,
        content text NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      )
    `;

    try {
      await sql`
        ALTER TABLE "discussionMessage"
        ADD CONSTRAINT discussionMessage_userId_fkey
        FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE
      `;
    } catch {
      // constraint exists or can't be created; ignore
    }
  } catch (error) {
    console.error("Failed to create discussionMessage table:", error);
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "discussionReadState" (
        "userId" text NOT NULL,
        "entityType" text NOT NULL,
        "entityId" text NOT NULL,
        "lastReadAt" timestamp NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("userId", "entityType", "entityId")
      )
    `;

    try {
      await sql`
        ALTER TABLE "discussionReadState"
        ADD CONSTRAINT discussionReadState_userId_fkey
        FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE
      `;
    } catch {
      // constraint exists or can't be created; ignore
    }
  } catch (error) {
    console.error("Failed to create discussionReadState table:", error);
  }
}

