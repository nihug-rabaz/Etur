import { readFileSync } from "fs";
import { join } from "path";

import { sql } from "@/lib/db";

export async function runMigration(migrationFileName: string) {
  try {
    const migrationPath = join(process.cwd(), "drizzle", migrationFileName);
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await sql(statement);
    }

    console.log(`Migration ${migrationFileName} completed successfully`);
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}
