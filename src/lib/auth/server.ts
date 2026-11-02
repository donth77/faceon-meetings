import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { haveIBeenPwned, oAuthProxy } from "better-auth/plugins";

import { createAvatarSeed } from "@/lib/avatars/seed";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { emailPasswordEnabled, sendInBackground } from "@/lib/email/send";
import {
  accountEmail,
  emailLocale,
  type AccountEmail,
} from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { siteUrl } from "@/lib/site";

import { dropUnverifiedPassword } from "./linking";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password";

/** Production origin. Preview deployments send OAuth through it (oAuthProxy). */
const productionUrl =
  publicEnv.NEXT_PUBLIC_APP_URL ?? "https://joinfaceon.vercel.app";

/** Sends an account email to a user, in their language, after the response. */
function emailUser(
  kind: AccountEmail,
  user: { email: string; name: string },
  url: string,
) {
  sendInBackground(
    accountEmail(kind, {
      to: user.email,
      name: user.name,
      url,
      locale: emailLocale(user),
    }),
  );
}

/**
 * Accounts: Google, GitHub, or email and password. The first social sign-in creates the
 * account; an email account must verify its address before it can sign in. Accounts with
 * the same verified email are linked. Responses never reveal whether an email has an
 * account.
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
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
      // Google or GitHub may link to an account whose email was never verified; the
      // hook below drops that account's password first.
      requireLocalEmailVerified: false,
    },
    encryptOAuthTokens: true,
  },
  emailAndPassword: {
    // Needs email delivery: Resend, or the server log in development.
    enabled: emailPasswordEnabled(),
    requireEmailVerification: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => emailUser("reset", user, url),
    onPasswordReset: async ({ user }) =>
      emailUser("changed", user, `${siteUrl()}/forgot-password`),
    // Signing up with a taken email looks like any other sign-up; the owner gets a note.
    onExistingUserSignUp: async ({ user }) =>
      emailUser("existing", user, `${siteUrl()}/sign-in`),
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      ...additionalFields,
      avatarSeed: createAvatarSeed(coreFields.name),
      avatarSource: "dicebear",
      id,
    }),
  },
  emailVerification: {
    sendOnSignUp: true,
    // Signing in before verifying sends a fresh link.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 24 * 60 * 60,
    sendVerificationEmail: async ({ user, url }) =>
      emailUser("verify", user, url),
  },
  user: {
    additionalFields: {
      locale: { type: "string", required: false, input: false },
      avatarSeed: { type: "string", required: false, input: false },
      avatarSource: { type: "string", required: false, input: false },
    },
  },
  databaseHooks: {
    account: {
      create: {
        before: async (created) => {
          if (created.providerId !== "credential") {
            await dropUnverifiedPassword(created.userId);
          }
        },
      },
    },
    user: {
      create: {
        // Every new account gets a friendly default avatar (DiceBear "Dylan").
        before: async (user) => ({
          data: {
            ...user,
            avatarSeed: createAvatarSeed(user.name),
            avatarSource: "dicebear",
          },
        }),
      },
    },
  },
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
    },
  },
  trustedOrigins: [
    productionUrl,
    "http://localhost:3000",
    "https://*-tom-9345s-projects.vercel.app",
  ],
  plugins: [
    oAuthProxy({ productionURL: productionUrl }),
    // Refuses passwords known from data breaches (only a hash prefix leaves the server).
    haveIBeenPwned(),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
