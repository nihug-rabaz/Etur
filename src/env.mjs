/** @type {{ DATABASE_URL: string; APP_URL: string; GOOGLE_SITE_VERIFICATION_ID: string; NEXTAUTH_SECRET: string; NEXTAUTH_URL: string }} */
export const env = {
  get DATABASE_URL() {
    return process.env.DATABASE_URL || "";
  },
  get APP_URL() {
    return process.env.APP_URL || "http://localhost:3000";
  },
  get GOOGLE_SITE_VERIFICATION_ID() {
    return process.env.GOOGLE_SITE_VERIFICATION_ID || "";
  },
  get NEXTAUTH_SECRET() {
    return process.env.NEXTAUTH_SECRET || "dev-secret-change-me";
  },
  get NEXTAUTH_URL() {
    return process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  },
};
