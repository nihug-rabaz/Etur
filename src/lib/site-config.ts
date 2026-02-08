import { env } from "@/env.mjs";

export const siteConfig = {
  title: "Next.js Starter",
  description:
    "A Next.js starter template, packed with features like TypeScript, Tailwind CSS, Eslint, testing tools and more. Jumpstart your project with efficiency and style.",
  keywords: ["Next.js", "TypeScript", "Tailwind CSS"],
  url: env.APP_URL || "http://localhost:3000",
  googleSiteVerificationId: env.GOOGLE_SITE_VERIFICATION_ID || "",
};
