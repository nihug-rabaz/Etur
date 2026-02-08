import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";

import { db, sql } from "@/lib/db";
import { users } from "@/lib/schema";

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

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db) as Adapter,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const userResult = await db
            .select()
            .from(users)
            .where(eq(users.email, credentials.email as string))
            .limit(1);

          if (userResult.length === 0) {
            return null;
          }

          const user = userResult[0];

          if (!user.password) {
            console.error("User has no password");
            return null;
          }

          const isValidPassword = await bcrypt.compare(
            credentials.password as string,
            user.password,
          );

          if (!isValidPassword) {
            return null;
          }

          const userRole = (user as any).role || "חפ״ש";

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: userRole,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = (user as any).role || "חפ״ש";
      }
      
      if (trigger === "update") {
        try {
          await ensureRoleColumn();
          const currentUser = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, token.id as string))
            .limit(1);
          if (currentUser.length > 0) {
            token.role = currentUser[0].role || "חפ״ש";
          }
        } catch {
          try {
            const [row] = await sql`
              SELECT role FROM "user" WHERE id = ${token.id as string} LIMIT 1
            `;
            if (row) {
              token.role = (row as { role: string }).role || "חפ״ש";
            }
          } catch {
            token.role = token.role || "חפ״ש";
          }
        }
      }

      token.role = token.role ?? "חפ״ש";
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.role = (token.role as string) || "חפ״ש";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production",
});
