import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { captcha, haveIBeenPwned, oAuthProxy } from "better-auth/plugins";

import { endHostedCalls, forgetMediaUser } from "@/lib/account/deletion";
import { lookForName } from "@/lib/avatars/name-look";
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
import { refreshGoogleToken } from "@/lib/google-calendar/refresh";
import { hasCalendarScope } from "@/lib/google-calendar/shared";
import { forgetApprovedHost } from "@/lib/hosting/allowlist";
import { ACCOUNT_EMAIL_ENDPOINTS } from "@/lib/human-check";
import { humanCheckSecret } from "@/lib/human-check/verify";
import { siteUrl } from "@/lib/site";

import { desktopHandoff } from "./desktop-handoff";
import { dropUnverifiedPassword } from "./linking";
import { authOrigins } from "./origins";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password";

/** Production origin. Preview deployments send OAuth through it (oAuthProxy). */
const productionUrl = siteUrl();

/** Cloudflare Turnstile's secret, where this copy checks for a person (lib/human-check). */
const turnstileSecret = humanCheckSecret();

/** Calendar sync reads its tokens through `auth`, so the hooks load it when they run. */
const googleCalendar = () => import("@/lib/google-calendar/connection");
const revokeGoogleCalendar = async (userId: string) =>
  (await googleCalendar()).revokeGoogleCalendar(userId);
const disconnectGoogleCalendar = async (userId: string) =>
  (await googleCalendar()).disconnectGoogleCalendar(userId);
const cancelUpcomingEvents = async (userId: string) =>
  (await import("@/lib/google-calendar/sync")).cancelUpcomingEvents(userId);

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
    // Sign-in asks only for openid, email and profile. Calendar sync adds its scope later,
    // when a host connects Google Calendar (incremental consent through linkSocial).
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refreshAccessToken: refreshGoogleToken,
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
      avatarSeed: createAvatarSeed(lookForName(coreFields.name)),
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
    // Settings → Account → Delete account; a recent sign-in (or the password) confirms it.
    // Meetings go with the user (foreign keys). First, calls in progress end, upcoming
    // meetings leave Google Calendar (Google tells the invitees), and access is revoked.
    deleteUser: {
      enabled: true,
      beforeDelete: async (deleted) => {
        await endHostedCalls(deleted.id);
        await cancelUpcomingEvents(deleted.id);
        await revokeGoogleCalendar(deleted.id);
      },
      afterDelete: async (deleted) => {
        await forgetMediaUser(deleted.id);
        // Off the list of approved hosts too, if an admin had added them.
        await forgetApprovedHost(deleted.email);
      },
    },
    additionalFields: {
      locale: { type: "string", required: false, input: false },
      avatarSeed: { type: "string", required: false, input: false },
      avatarSource: { type: "string", required: false, input: false },
      // Settings → AI notes: whether meetings this person hosts offer AI notes. Read from
      // the database (lib/meetings/notes.ts), since the session's copy can lag.
      aiNotes: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      // The options this person last scheduled a meeting with (schedule-defaults.ts).
      // Only the schedule page reads them, from the database.
      scheduleDefaults: {
        type: "json",
        required: false,
        input: false,
        returned: false,
      },
      // Settings → Notifications: email reminders before meetings, when they're on
      // (lib/reminders). Read from the database by the reminders and their setting.
      emailReminders: {
        type: "json",
        required: false,
        input: false,
        returned: false,
      },
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
      delete: {
        // Removing Google as a sign-in method also disconnects Google Calendar.
        before: async (removed) => {
          if (
            removed.providerId === "google" &&
            hasCalendarScope(removed.scope)
          ) {
            await disconnectGoogleCalendar(removed.userId);
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
            avatarSeed: createAvatarSeed(lookForName(user.name)),
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
      "/desktop/handoff": { window: 60, max: 10 },
      "/desktop/session": { window: 60, max: 20 },
    },
  },
  trustedOrigins: authOrigins({
    productionUrl,
    vercelUrl: process.env.VERCEL_URL,
    vercelBranchUrl: process.env.VERCEL_BRANCH_URL,
    development: process.env.NODE_ENV !== "production",
  }),
  plugins: [
    oAuthProxy({ productionURL: productionUrl }),
    // Refuses passwords known from data breaches, including one set in Settings →
    // Account (only a hash prefix leaves the server).
    haveIBeenPwned({
      paths: [
        "/sign-up/email",
        "/change-password",
        "/reset-password",
        "/set-password",
      ],
    }),
    // Requests that send email need a person behind them, where Turnstile is set up:
    // signing up, a password reset, and the verification email again. No expected
    // action: the plugin would need an exact match, Cloudflare's test keys answer
    // without one, and each token works only once anyway.
    ...(turnstileSecret
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: turnstileSecret,
            endpoints: ACCOUNT_EMAIL_ENDPOINTS,
          }),
        ]
      : []),
    desktopHandoff(),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
