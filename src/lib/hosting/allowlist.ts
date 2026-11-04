import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  notInArray,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { hostAllowlist, hostInvitation, user } from "@/lib/db/schema";
import { approvedBySettings } from "@/lib/meetings/hosting";
import { fetchPage, pageOf, splitRows } from "@/lib/pagination";
import { serverEnv } from "@/lib/server-env";

import {
  INVITES_PER_ADDRESS,
  RESEND_AFTER_MS,
  startOfUtcDay,
  type AccountState,
} from "./invites";

/** An approved host, as Settings → Admin lists them. */
export type ApprovedHost = {
  email: string;
  /** "settings": HOST_ALLOWLIST, changed where the app is hosted; "admin": added here. */
  source: "settings" | "admin";
  /** Whether someone has signed up with this address yet, and verified it. */
  account: AccountState;
  addedBy: string | null;
  createdAt: Date | null;
  /** The admin's own note on who this is; only admins see it. */
  note: string | null;
  /** When an admin last emailed it an invitation, and how many it's had, whichever list it's on. */
  invitedAt: Date | null;
  inviteCount: number;
};

/**
 * A page of everyone approved to host full meetings: the operator's HOST_ALLOWLIST, then
 * the addresses admins added, newest first, as one list. Admins (ADMIN_EMAILS) are listed
 * apart, and an address the settings already approve isn't listed again from the table.
 */
export async function approvedHosts(requested: number) {
  const env = serverEnv();
  const settings = unique(
    env.HOST_ALLOWLIST.filter((email) => !env.ADMIN_EMAILS.includes(email)),
  );
  const inSettings = [...env.HOST_ALLOWLIST, ...env.ADMIN_EMAILS];
  const notInSettings =
    inSettings.length > 0
      ? notInArray(hostAllowlist.email, inSettings)
      : undefined;
  const { rows, page } = await fetchPage(
    requested,
    async () => {
      const [row] = await db()
        .select({ total: count() })
        .from(hostAllowlist)
        .where(notInSettings);
      return settings.length + (row?.total ?? 0);
    },
    async (offset, limit) => {
      const { head, tail } = splitRows(offset, limit, settings.length);
      const fromTable =
        tail.limit > 0
          ? await db()
              .select({
                email: hostAllowlist.email,
                createdAt: hostAllowlist.createdAt,
                note: hostAllowlist.note,
                addedBy: user.name,
              })
              .from(hostAllowlist)
              .leftJoin(user, eq(user.id, hostAllowlist.addedBy))
              .where(notInSettings)
              .orderBy(desc(hostAllowlist.createdAt), asc(hostAllowlist.email))
              .limit(tail.limit)
              .offset(tail.offset)
          : [];
      return [
        ...settings.slice(head.start, head.end).map((email) => ({
          email,
          source: "settings" as const,
          addedBy: null,
          createdAt: null,
          note: null,
        })),
        ...fromTable.map((row) => ({ ...row, source: "admin" as const })),
      ];
    },
  );
  const emails = rows.map((host) => host.email);
  const [accounts, invitations] = await Promise.all([
    accountStates(emails),
    invitationsTo(emails),
  ]);
  return {
    rows: rows.map((host): ApprovedHost => {
      const invitation = invitations.get(host.email);
      return {
        ...host,
        account: accounts.get(host.email) ?? "none",
        invitedAt: invitation?.invitedAt ?? null,
        inviteCount: invitation?.inviteCount ?? 0,
      };
    }),
    page,
  };
}

/** A page of the admins (ADMIN_EMAILS, set where the app is hosted), in their order. */
export async function adminAddresses(requested: number) {
  const admins = unique(serverEnv().ADMIN_EMAILS);
  const page = pageOf(requested, admins.length);
  const emails = admins.slice(page.offset, page.offset + page.perPage);
  const accounts = await accountStates(emails);
  return {
    rows: emails.map((email) => ({ email, hasAccount: accounts.has(email) })),
    page,
  };
}

/** Which of these (lowercased) addresses someone has signed up with, and verified. */
async function accountStates(
  emails: string[],
): Promise<Map<string, AccountState>> {
  if (emails.length === 0) return new Map();
  const lowered = sql<string>`lower(${user.email})`;
  const accounts = await db()
    .select({ email: lowered, verified: user.emailVerified })
    .from(user)
    .where(inArray(lowered, emails));
  return new Map(
    accounts.map((account) => [
      account.email,
      account.verified ? "verified" : "unverified",
    ]),
  );
}

/** The invitation emails these (lowercased) addresses have had, by address. */
async function invitationsTo(
  emails: string[],
): Promise<Map<string, { invitedAt: Date; inviteCount: number }>> {
  if (emails.length === 0) return new Map();
  const rows = await db()
    .select({
      email: hostInvitation.email,
      invitedAt: hostInvitation.invitedAt,
      inviteCount: hostInvitation.inviteCount,
    })
    .from(hostInvitation)
    .where(inArray(hostInvitation.email, emails));
  return new Map(rows.map(({ email, ...invitation }) => [email, invitation]));
}

function unique(emails: string[]): string[] {
  return [...new Set(emails)];
}

/** An admin approves an address, before or after its owner signs up. */
export async function addApprovedHost(input: {
  email: string;
  note: string | null;
  adminId: string;
}): Promise<"added" | "exists" | "settings"> {
  const address = input.email.trim().toLowerCase();
  if (approvedBySettings(address)) return "settings";
  const inserted = await db()
    .insert(hostAllowlist)
    .values({ email: address, addedBy: input.adminId, note: input.note })
    .onConflictDoNothing()
    .returning({ email: hostAllowlist.email });
  return inserted.length > 0 ? "added" : "exists";
}

/**
 * An admin moves an address back to demo meetings, from its owner's next meeting: a
 * meeting already running keeps the limits it started with. Its invitations go with it.
 * Addresses from the operator's settings can only be changed there.
 */
export async function removeApprovedHost(
  email: string,
): Promise<"removed" | "missing" | "settings"> {
  const address = email.trim().toLowerCase();
  if (approvedBySettings(address)) return "settings";
  const removed = await db()
    .delete(hostAllowlist)
    .where(eq(hostAllowlist.email, address))
    .returning({ email: hostAllowlist.email });
  await forgetInvitations(address);
  return removed.length > 0 ? "removed" : "missing";
}

/** Deleting an account takes its address off the list too, with its invitations. */
export async function forgetApprovedHost(email: string): Promise<void> {
  const address = email.trim().toLowerCase();
  await db().delete(hostAllowlist).where(eq(hostAllowlist.email, address));
  await forgetInvitations(address);
}

async function forgetInvitations(address: string): Promise<void> {
  await db().delete(hostInvitation).where(eq(hostInvitation.email, address));
}

/**
 * The daily sweep: deletes the invitations of addresses no longer approved anywhere, off
 * the list and out of the operator's settings.
 */
export async function pruneInvitations(): Promise<number> {
  const env = serverEnv();
  const inSettings = [...env.HOST_ALLOWLIST, ...env.ADMIN_EMAILS];
  const onList = db()
    .select({ email: hostAllowlist.email })
    .from(hostAllowlist);
  const deleted = await db()
    .delete(hostInvitation)
    .where(
      and(
        notInArray(hostInvitation.email, onList),
        inSettings.length > 0
          ? notInArray(hostInvitation.email, inSettings)
          : undefined,
      ),
    )
    .returning({ email: hostInvitation.email });
  return deleted.length;
}

/**
 * What an invitation email to this address depends on: whether it's approved (on the
 * list, or in the operator's settings), the invitations it's had, and whether it has an
 * account.
 */
export async function invitationTarget(email: string): Promise<{
  approved: boolean;
  inviteCount: number;
  invitedAt: Date | null;
  account: AccountState;
}> {
  const address = email.trim().toLowerCase();
  const [listed, invitations, accounts] = await Promise.all([
    approvedBySettings(address) ||
      db()
        .select({ email: hostAllowlist.email })
        .from(hostAllowlist)
        .where(eq(hostAllowlist.email, address))
        .then((rows) => rows.length > 0),
    invitationsTo([address]),
    accountStates([address]),
  ]);
  const invitation = invitations.get(address);
  return {
    approved: listed,
    inviteCount: invitation?.inviteCount ?? 0,
    invitedAt: invitation?.invitedAt ?? null,
    account: accounts.get(address) ?? "none",
  };
}

/** Invitation emails this admin has sent today (UTC), for the daily cap. */
export async function invitationsSentToday(
  adminId: string,
  now = new Date(),
): Promise<number> {
  const [row] = await db()
    .select({ total: count() })
    .from(hostInvitation)
    .where(
      and(
        eq(hostInvitation.invitedBy, adminId),
        gte(hostInvitation.invitedAt, startOfUtcDay(now)),
      ),
    );
  return row?.total ?? 0;
}

/** An address's latest invitation before claimInvitation noted another; null for its first. */
export type InvitationBefore = {
  invitedAt: Date;
  invitedBy: string | null;
} | null;

/**
 * Notes an invitation email before it goes, only while the address is still within its
 * limits, so two clicks at once send one. Gives back what to restore if sending fails;
 * false when another send got there first or a limit was reached.
 */
export async function claimInvitation(input: {
  email: string;
  adminId: string;
  now: Date;
}): Promise<{ before: InvitationBefore } | false> {
  const address = input.email.trim().toLowerCase();
  const [before] = await db()
    .select({
      invitedAt: hostInvitation.invitedAt,
      invitedBy: hostInvitation.invitedBy,
    })
    .from(hostInvitation)
    .where(eq(hostInvitation.email, address));
  if (!before) {
    const inserted = await db()
      .insert(hostInvitation)
      .values({
        email: address,
        invitedAt: input.now,
        invitedBy: input.adminId,
      })
      .onConflictDoNothing()
      .returning({ email: hostInvitation.email });
    return inserted.length > 0 ? { before: null } : false;
  }
  const resendFrom = new Date(input.now.getTime() - RESEND_AFTER_MS);
  const claimed = await db()
    .update(hostInvitation)
    .set({
      invitedAt: input.now,
      invitedBy: input.adminId,
      inviteCount: sql`${hostInvitation.inviteCount} + 1`,
    })
    .where(
      and(
        eq(hostInvitation.email, address),
        sql`${hostInvitation.inviteCount} < ${INVITES_PER_ADDRESS}`,
        eq(hostInvitation.invitedAt, before.invitedAt),
        lte(hostInvitation.invitedAt, resendFrom),
      ),
    )
    .returning({ email: hostInvitation.email });
  return claimed.length > 0 ? { before } : false;
}

/** Undoes claimInvitation when the email didn't go. */
export async function releaseInvitation(input: {
  email: string;
  claimedAt: Date;
  before: InvitationBefore;
}): Promise<void> {
  const claimed = and(
    eq(hostInvitation.email, input.email.trim().toLowerCase()),
    eq(hostInvitation.invitedAt, input.claimedAt),
  );
  if (!input.before) {
    await db().delete(hostInvitation).where(claimed);
    return;
  }
  await db()
    .update(hostInvitation)
    .set({
      invitedAt: input.before.invitedAt,
      invitedBy: input.before.invitedBy,
      inviteCount: sql`greatest(${hostInvitation.inviteCount} - 1, 1)`,
    })
    .where(claimed);
}
