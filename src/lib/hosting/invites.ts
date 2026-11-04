/**
 * Inviting approved hosts, as pure rules shared by Settings → Admin and the server. The
 * invite link is the free way: the admin sends it however they like. FaceOn emails an
 * invitation only when the admin chooses to, because every email counts against the
 * free plan's daily allowance, and these limits keep that in check. Approval itself is
 * still the verified address (lib/meetings/hosting.ts): neither the link nor the email
 * grants anything.
 */
import { isEmailAddress } from "@/lib/email-address";

/** How long before the same address may be emailed again. */
export const RESEND_AFTER_MS = 60 * 60 * 1000;

/** Invitation emails one address may get in all; after that, the link. */
export const INVITES_PER_ADDRESS = 3;

/** Invitation emails one admin may send in a day (UTC). */
export const INVITES_PER_ADMIN_PER_DAY = 20;

/** Whether the address has an account, and whether its owner has verified it. */
export type AccountState = "none" | "unverified" | "verified";

/**
 * What Settings → Admin says about an approved address, whichever list it's on: Joined
 * (signed up and verified, so hosting counts), signed up but not verified yet, Invited
 * (no account, emailed an invitation), or no account yet.
 */
export type HostStatus = "joined" | "unverified" | "invited" | "noAccount";

export function hostStatus(input: {
  account: AccountState;
  invitedAt: Date | null;
}): HostStatus {
  if (input.account === "verified") return "joined";
  if (input.account === "unverified") return "unverified";
  return input.invitedAt ? "invited" : "noAccount";
}

/**
 * Sign-up with the address filled in: no locale in the path, so FaceOn picks the
 * invitee's own language.
 */
export function inviteLink(site: string, email: string): string {
  return `${site.replace(/\/$/, "")}/sign-up?email=${encodeURIComponent(email.trim().toLowerCase())}`;
}

/** The address an invite link fills in on sign-up, if `?email=` holds one. */
export function invitedEmail(value: string | null | undefined): string | null {
  const address = value?.trim().toLowerCase() ?? "";
  if (address.length === 0 || address.length > 254) return null;
  return isEmailAddress(address) ? address : null;
}

/** Why an invitation email can't go now; null when it can. */
export type InviteRefusal =
  /** They signed up already: there's nothing to invite them to. */
  | { reason: "hasAccount" }
  /** Emailed within the last hour. */
  | { reason: "tooSoon"; retryAt: Date }
  /** INVITES_PER_ADDRESS reached: the link still works. */
  | { reason: "tooMany"; count: number }
  /** The admin's INVITES_PER_ADMIN_PER_DAY for today. */
  | { reason: "dailyCap"; count: number };

export function inviteRefusal(input: {
  account: AccountState;
  inviteCount: number;
  invitedAt: Date | null;
  /** Invitation emails this admin has sent today (UTC). */
  sentToday: number;
  now: Date;
}): InviteRefusal | null {
  if (input.account !== "none") return { reason: "hasAccount" };
  if (input.inviteCount >= INVITES_PER_ADDRESS) {
    return { reason: "tooMany", count: input.inviteCount };
  }
  if (input.invitedAt) {
    const retryAt = new Date(input.invitedAt.getTime() + RESEND_AFTER_MS);
    if (retryAt > input.now) return { reason: "tooSoon", retryAt };
  }
  if (input.sentToday >= INVITES_PER_ADMIN_PER_DAY) {
    return { reason: "dailyCap", count: input.sentToday };
  }
  return null;
}

/**
 * Adding an address that's already approved, with an invitation asked for, sends none: the
 * row it's already on has the invitation, and this says what it offers instead.
 */
export type AlreadyListed =
  /** Signed up already: there's nothing to invite them to. */
  | "hasAccount"
  /** Never emailed: the row's Send invitation. */
  | "sendFromRow"
  /** Emailed before: the row's Resend invitation. */
  | "resendFromRow"
  /** All INVITES_PER_ADDRESS sent: the row's invite link. */
  | "allSent";

export function alreadyListed(input: {
  account: AccountState;
  inviteCount: number;
}): AlreadyListed {
  if (input.account !== "none") return "hasAccount";
  if (input.inviteCount >= INVITES_PER_ADDRESS) return "allSent";
  return input.inviteCount > 0 ? "resendFromRow" : "sendFromRow";
}

/** The start of `now`'s day in UTC, which the daily cap counts from. */
export function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
