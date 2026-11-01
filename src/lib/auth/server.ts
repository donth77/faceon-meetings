import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { oAuthProxy } from "better-auth/plugins";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { publicEnv } from "@/lib/env";

/** Production origin. Preview deployments send OAuth through it (oAuthProxy). */
const productionUrl =
  publicEnv.NEXT_PUBLIC_APP_URL ?? "https://joinfaceon.vercel.app";

/**
 * Accounts: Google or GitHub sign-in only (no passwords, no emails to send). The first
 * sign-in creates the account. Accounts with the same verified email are linked.
 */
export const auth = betterAuth({
  appName: publicEnv.NEXT_PUBLIC_APP_NAME,
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db(), { provider: "pg", schema }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
    encryptOAuthTokens: true,
  },
  user: {
    additionalFields: {
      locale: { type: "string", required: false, input: false },
      avatarSeed: { type: "string", required: false, input: false },
      avatarSource: { type: "string", required: false, input: false },
    },
  },
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  rateLimit: { enabled: true, storage: "database" },
  trustedOrigins: [
    productionUrl,
    "http://localhost:3000",
    "https://*-tom-9345s-projects.vercel.app",
  ],
  plugins: [oAuthProxy({ productionURL: productionUrl }), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
