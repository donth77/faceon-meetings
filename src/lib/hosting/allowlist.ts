import "server-only";

import { asc, count, desc, eq, inArray, notInArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { hostAllowlist, user } from "@/lib/db/schema";
import { approvedBySettings } from "@/lib/meetings/hosting";
import { fetchPage, pageOf, splitRows } from "@/lib/pagination";
import { serverEnv } from "@/lib/server-env";

/** An approved host, as Settings → Admin lists them. */
export type ApprovedHost = {
  email: string;
  /** "settings": HOST_ALLOWLIST, changed where the app is hosted; "admin": added here. */
  source: "settings" | "admin";
  /** Whether someone has signed up with this address yet. */
  hasAccount: boolean;
  addedBy: string | null;
  createdAt: Date | null;
  /** The admin's own note on who this is; only admins see it. */
  note: string | null;
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
  const accounts = await signedUp(rows.map((host) => host.email));
  return {
    rows: rows.map((host): ApprovedHost => ({
      ...host,
      hasAccount: accounts.has(host.email),
    })),
    page,
  };
}

/** A page of the admins (ADMIN_EMAILS, set where the app is hosted), in their order. */
export async function adminAddresses(requested: number) {
  const admins = unique(serverEnv().ADMIN_EMAILS);
  const page = pageOf(requested, admins.length);
  const emails = admins.slice(page.offset, page.offset + page.perPage);
  const accounts = await signedUp(emails);
  return {
    rows: emails.map((email) => ({ email, hasAccount: accounts.has(email) })),
    page,
  };
}

/** Which of these (lowercased) addresses someone has signed up with. */
async function signedUp(emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const lowered = sql<string>`lower(${user.email})`;
  const accounts = await db()
    .select({ email: lowered })
    .from(user)
    .where(inArray(lowered, emails));
  return new Set(accounts.map((account) => account.email));
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
