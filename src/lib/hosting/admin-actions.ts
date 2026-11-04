"use server";

import { getSession } from "@/lib/auth/session";
import { emailPasswordEnabled } from "@/lib/email/send";
import { loggable } from "@/lib/log";
import { isAdmin } from "@/lib/meetings/hosting";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { z } from "@/lib/zod";

import {
  addApprovedHost,
  claimInvitation,
  invitationsSentToday,
  invitationTarget,
  releaseInvitation,
  removeApprovedHost,
} from "./allowlist";
import { emailInvitation } from "./emails";
import { inviteRefusal } from "./invites";
import { decideRequest } from "./requests";
import { RequestNote } from "./rules";

/*
 * Settings → Admin's actions. Each does one hosting decision and checks, every time, that the
 * caller is an admin (lib/meetings/hosting.ts, isAdmin). There's deliberately nothing
 * else: no admin can change, delete or impersonate an account, or read its meetings.
 */

type Refusal = "notAllowed" | "invalid" | "tooManyTries";

/** The signed-in admin, within their rate limit; otherwise why not. */
async function admin(): Promise<
  { id: string; name: string; locale: string | null } | Refusal
> {
  const session = await getSession();
  if (!session || !isAdmin(session.user)) return "notAllowed";
  const limit = [{ key: `admin:${session.user.id}`, max: 120 }];
  if (await isLimited(limit)) return "tooManyTries";
  await recordAttempt(limit);
  const { id, name } = session.user;
  const locale = "locale" in session.user ? session.user.locale : null;
  return { id, name, locale: typeof locale === "string" ? locale : null };
}

/** Approve or decline an open request; the person gets an email either way. */
export async function decideRequestAction(
  id: unknown,
  approve: unknown,
): Promise<"done" | "answered" | Refusal> {
  const parsed = z
    .object({ id: z.uuid(), approve: z.boolean() })
    .safeParse({ id, approve });
  if (!parsed.success) return "invalid";
  const caller = await admin();
  if (typeof caller === "string") return caller;
  const done = await decideRequest({ ...parsed.data, adminId: caller.id });
  return done ? "done" : "answered";
}

/** What emailing an invitation did. */
export type InviteResult =
  | "sent"
  /** They have an account already: nothing to invite them to. */
  | "hasAccount"
  /** Emailed within the hour, or another send got there first. */
  | "tooSoon"
  /** The address has had all its invitation emails. */
  | "tooMany"
  /** This admin's invitations for today are used up. */
  | "dailyCap"
  /** This copy has no email delivery. */
  | "noEmail"
  /** Not on the list an admin keeps (the operator's settings, or removed). */
  | "notListed"
  | "failed";

const Message = RequestNote.optional();

/**
 * Emails an approved address its invitation, within the limits in lib/hosting/invites.ts:
 * noted first, so two clicks send one, and un-noted if Resend refuses it.
 */
async function invite(
  email: string,
  message: string | null,
  caller: { id: string; name: string; locale: string | null },
): Promise<InviteResult> {
  if (!emailPasswordEnabled()) return "noEmail";
  const now = new Date();
  const [target, sentToday] = await Promise.all([
    invitationTarget(email),
    invitationsSentToday(caller.id, now),
  ]);
  if (!target.row) return "notListed";
  const refusal = inviteRefusal({
    account: target.account,
    inviteCount: target.row.inviteCount,
    invitedAt: target.row.invitedAt,
    sentToday,
    now,
  });
  if (refusal) return refusal.reason;
  const before = await claimInvitation({ email, adminId: caller.id, now });
  if (!before) return "tooSoon";
  try {
    await emailInvitation({ to: email, admin: caller, message });
    return "sent";
  } catch (error) {
    console.error("An invitation email failed to send", loggable(error));
    await releaseInvitation({ email, claimedAt: now, before }).catch(
      (undo: unknown) => {
        console.error("Couldn't undo a failed invitation", loggable(undo));
      },
    );
    return "failed";
  }
}

/**
 * Approve an address to host full meetings, before or after its owner signs up. With
 * `sendInvitation`, and only then, it's emailed an invitation too, carrying `message`.
 */
export async function addApprovedHostAction(input: {
  email: unknown;
  note: unknown;
  sendInvitation: unknown;
  message: unknown;
}): Promise<
  | {
      added: "added" | "exists" | "settings";
      invitation: InviteResult | null;
    }
  | Refusal
> {
  const parsed = z
    .object({
      email: z.email().max(254),
      note: RequestNote.optional(),
      sendInvitation: z.boolean().default(false),
      message: Message,
    })
    .safeParse({
      email: input.email,
      note: input.note ?? undefined,
      sendInvitation: input.sendInvitation ?? undefined,
      message: input.message ?? undefined,
    });
  if (!parsed.success) return "invalid";
  const caller = await admin();
  if (typeof caller === "string") return caller;
  const address = parsed.data.email.trim().toLowerCase();
  const added = await addApprovedHost({
    email: address,
    note: parsed.data.note || null,
    adminId: caller.id,
  });
  const invitation =
    added === "added" && parsed.data.sendInvitation
      ? await invite(address, parsed.data.message || null, caller)
      : null;
  return { added, invitation };
}

/** Email an approved address an invitation, or again, within the limits. */
export async function sendInvitationAction(
  email: unknown,
  message: unknown,
): Promise<InviteResult | Refusal> {
  const parsed = z
    .object({ email: z.email().max(254), message: Message })
    .safeParse({ email, message: message ?? undefined });
  if (!parsed.success) return "invalid";
  const caller = await admin();
  if (typeof caller === "string") return caller;
  return invite(
    parsed.data.email.trim().toLowerCase(),
    parsed.data.message || null,
    caller,
  );
}

/** Move an approved address back to demo meetings, from its owner's next meeting. */
export async function removeApprovedHostAction(
  email: unknown,
): Promise<"removed" | "missing" | "settings" | Refusal> {
  const parsed = z.email().max(254).safeParse(email);
  if (!parsed.success) return "invalid";
  const caller = await admin();
  if (typeof caller === "string") return caller;
  return removeApprovedHost(parsed.data);
}
