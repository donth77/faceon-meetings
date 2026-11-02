import "server-only";

import type { SessionLimits } from "@/lib/media/types";
import { serverEnv } from "@/lib/server-env";

/**
 * Approved hosts host full meetings; every other account hosts demos. A host is approved
 * by `ADMIN_EMAILS` or `HOST_ALLOWLIST` (the operator's settings), or by an admin on
 * Settings → Admin (`approved`: the address is on the database's list, which lib/hosting reads).
 */
export type HostingPlan = "full" | "demo";

type Account = { email: string; emailVerified: boolean };

/** Only a verified email counts, so nobody can claim an approved address. */
export function hostingPlan(host: Account, approved = false): HostingPlan {
  return host.emailVerified && (approved || approvedBySettings(host.email))
    ? "full"
    : "demo";
}

/** Approved by the operator's settings, which the app can't change. */
export function approvedBySettings(email: string): boolean {
  const env = serverEnv();
  const address = email.toLowerCase();
  return (
    env.ADMIN_EMAILS.includes(address) || env.HOST_ALLOWLIST.includes(address)
  );
}

/**
 * Admins (`ADMIN_EMAILS`, with a verified address) open Settings → Admin and decide who hosts full
 * meetings. Nothing else: no admin can change, delete or see into anyone's account.
 */
export function isAdmin(account: Account): boolean {
  return (
    account.emailVerified &&
    serverEnv().ADMIN_EMAILS.includes(account.email.toLowerCase())
  );
}

/** Limits for a new session; the media provider enforces them. */
export function limitsFor(plan: HostingPlan): SessionLimits {
  const env = serverEnv();
  if (plan === "demo") {
    return {
      maxParticipants: env.DEMO_MAX_PARTICIPANTS,
      maxDurationSeconds: env.DEMO_MAX_MINUTES * 60,
      demo: true,
    };
  }
  return {
    maxParticipants: env.MAX_PARTICIPANTS_PER_MEETING,
    ...(env.MAX_MEETING_MINUTES > 0
      ? { maxDurationSeconds: env.MAX_MEETING_MINUTES * 60 }
      : {}),
  };
}

/** What the Home page tells a host about their meetings. */
export function demoTerms() {
  const env = serverEnv();
  return {
    minutes: env.DEMO_MAX_MINUTES,
    people: env.DEMO_MAX_PARTICIPANTS,
    perDay: env.DEMO_MEETINGS_PER_DAY,
  };
}

/** What a full meeting allows, for the note and email that say a host was approved. */
export function fullTerms() {
  const env = serverEnv();
  return {
    people: env.MAX_PARTICIPANTS_PER_MEETING,
    /** 0: no time limit. */
    minutes: env.MAX_MEETING_MINUTES,
  };
}
