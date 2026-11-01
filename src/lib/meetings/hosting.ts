import "server-only";

import type { SessionLimits } from "@/lib/media/types";
import { serverEnv } from "@/lib/server-env";

/** Allowlisted accounts host full meetings; every other account hosts demos. */
export type HostingPlan = "full" | "demo";

/** Only a verified email counts, so nobody can claim an allowlisted address. */
export function hostingPlan(host: {
  email: string;
  emailVerified: boolean;
}): HostingPlan {
  const env = serverEnv();
  const email = host.email.toLowerCase();
  const listed =
    env.ADMIN_EMAILS.includes(email) || env.HOST_ALLOWLIST.includes(email);
  return host.emailVerified && listed ? "full" : "demo";
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
  };
}
