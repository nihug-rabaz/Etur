import { sql } from "@/lib/db";

const defaultDomains = ["פיתוח", "שיווק", "תמיכה", "מכירות", "ניהול"];

export async function seedDomains() {
  try {
    for (const domainName of defaultDomains) {
      await sql`
        INSERT INTO "domain" (id, name)
        VALUES (gen_random_uuid(), ${domainName})
        ON CONFLICT (name) DO NOTHING
      `;
    }
    console.log("Domains seeded successfully");
  } catch (error) {
    console.error("Error seeding domains:", error);
    throw error;
  }
}
