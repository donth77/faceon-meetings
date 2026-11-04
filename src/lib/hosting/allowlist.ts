import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  notInArray,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { hostAllowlist, user } from "@/lib/db/schema";
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
  /** When an admin last emailed it an invitation, and how many it's had. */
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
                invitedAt: hostAllowlist.invitedAt,
                inviteCount: hostAllowlist.inviteCount,
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
          invitedAt: null,
          inviteCount: 0,
        })),
        ...fromTable.map((row) => ({ ...row, source: "admin" as const })),
      ];
    },
  );
  const accounts = await accountStates(rows.map((host) => host.email));
  return {
    rows: rows.map((host): ApprovedHost => ({
      ...host,
      account: accounts.get(host.email) ?? "none",
    })),
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
 * meeting already running keeps the limits it started with. Addresses from the
 * operator's settings can only be changed there.
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
  return removed.length > 0 ? "removed" : "missing";
}

/** Deleting an account takes its address off the list too. */
export async function forgetApprovedHost(email: string): Promise<void> {
  await db()
    .delete(hostAllowlist)
    .where(eq(hostAllowlist.email, email.trim().toLowerCase()));
}

/**
 * What an invitation email to this address depends on: its row on the list (null when an
 * admin didn't add it, as for the operator's settings) and whether it has an account.
 */
export async function invitationTarget(email: string): Promise<{
  row: { inviteCount: number; invitedAt: Date | null } | null;
  account: AccountState;
}> {
  const address = email.trim().toLowerCase();
  const [[row], accounts] = await Promise.all([
    db()
      .select({
        inviteCount: hostAllowlist.inviteCount,
        invitedAt: hostAllowlist.invitedAt,
      })
      .from(hostAllowlist)
      .where(eq(hostAllowlist.email, address)),
    accountStates([address]),
  ]);
  return { row: row ?? null, account: accounts.get(address) ?? "none" };
}

/** Invitation emails this admin has sent today (UTC), for the daily cap. */
export async function invitationsSentToday(
  adminId: string,
  now = new Date(),
): Promise<number> {
  const [row] = await db()
    .select({ total: count() })
    .from(hostAllowlist)
    .where(
      and(
        eq(hostAllowlist.invitedBy, adminId),
        gte(hostAllowlist.invitedAt, startOfUtcDay(now)),
      ),
    );
  return row?.total ?? 0;
}

/**
 * Notes an invitation email before it goes, only while the address is still within its
 * limits, so two clicks at once send one. Gives back what to restore if sending fails;
 * null when another send got there first or a limit was reached.
 */
export async function claimInvitation(input: {
  email: string;
  adminId: string;
  now: Date;
}): Promise<{ invitedAt: Date | null; invitedBy: string | null } | null> {
  const address = input.email.trim().toLowerCase();
  const [before] = await db()
    .select({
      invitedAt: hostAllowlist.invitedAt,
      invitedBy: hostAllowlist.invitedBy,
    })
    .from(hostAllowlist)
    .where(eq(hostAllowlist.email, address));
  if (!before) return null;
  const resendFrom = new Date(input.now.getTime() - RESEND_AFTER_MS);
  const claimed = await db()
    .update(hostAllowlist)
    .set({
      invitedAt: input.now,
      invitedBy: input.adminId,
      inviteCount: sql`${hostAllowlist.inviteCount} + 1`,
    })
    .where(
      and(
        eq(hostAllowlist.email, address),
        sql`${hostAllowlist.inviteCount} < ${INVITES_PER_ADDRESS}`,
        before.invitedAt
          ? and(
              eq(hostAllowlist.invitedAt, before.invitedAt),
              lte(hostAllowlist.invitedAt, resendFrom),
            )
          : isNull(hostAllowlist.invitedAt),
      ),
    )
    .returning({ email: hostAllowlist.email });
  return claimed.length > 0 ? before : null;
}

/** Undoes claimInvitation when the email didn't go. */
export async function releaseInvitation(input: {
  email: string;
  claimedAt: Date;
  before: { invitedAt: Date | null; invitedBy: string | null };
}): Promise<void> {
  await db()
    .update(hostAllowlist)
    .set({
      invitedAt: input.before.invitedAt,
      invitedBy: input.before.invitedBy,
      inviteCount: sql`greatest(${hostAllowlist.inviteCount} - 1, 0)`,
    })
    .where(
      and(
        eq(hostAllowlist.email, input.email.trim().toLowerCase()),
        eq(hostAllowlist.invitedAt, input.claimedAt),
      ),
    );
}
