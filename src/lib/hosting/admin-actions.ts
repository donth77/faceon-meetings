"use server";

import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/meetings/hosting";
import { isLimited, recordAttempt } from "@/lib/rate-limit";

import { addApprovedHost, removeApprovedHost } from "./allowlist";
import { decideRequest } from "./requests";
import { RequestNote } from "./rules";

/*
 * Settings → Admin's actions. Each does one hosting decision and checks, every time, that the
 * caller is an admin (lib/meetings/hosting.ts, isAdmin). There's deliberately nothing
 * else: no admin can change, delete or impersonate an account, or read its meetings.
 */

type Refusal = "notAllowed" | "invalid" | "tooManyTries";

/** The signed-in admin, within their rate limit; otherwise why not. */
async function admin(): Promise<{ id: string } | Refusal> {
  const session = await getSession();
  if (!session || !isAdmin(session.user)) return "notAllowed";
  const limit = [{ key: `admin:${session.user.id}`, max: 120 }];
  if (await isLimited(limit)) return "tooManyTries";
  await recordAttempt(limit);
  return { id: session.user.id };
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

/** Approve an address to host full meetings, before or after its owner signs up. */
export async function addApprovedHostAction(
  email: unknown,
  note: unknown,
): Promise<"added" | "exists" | "settings" | Refusal> {
  const parsed = z
    .object({ email: z.email().max(254), note: RequestNote.optional() })
    .safeParse({ email, note: note ?? undefined });
  if (!parsed.success) return "invalid";
  const caller = await admin();
  if (typeof caller === "string") return caller;
  return addApprovedHost({
    email: parsed.data.email,
    note: parsed.data.note || null,
    adminId: caller.id,
  });
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
