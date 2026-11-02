import "server-only";

import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { hostAllowlist, user } from "@/lib/db/schema";
import { approvedBySettings } from "@/lib/meetings/hosting";
import { serverEnv } from "@/lib/server-env";

/** An approved host, as /admin lists them. */
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
 * Everyone approved to host full meetings: the operator's HOST_ALLOWLIST, then the
 * addresses admins added, newest first. Admins (ADMIN_EMAILS) are listed apart.
 */
export async function approvedHosts(): Promise<ApprovedHost[]> {
  const settings = serverEnv().HOST_ALLOWLIST.filter(
    (email) => !serverEnv().ADMIN_EMAILS.includes(email),
  );
  const added = await db()
    .select({
      email: hostAllowlist.email,
      createdAt: hostAllowlist.createdAt,
      note: hostAllowlist.note,
      addedBy: user.name,
    })
    .from(hostAllowlist)
    .leftJoin(user, eq(user.id, hostAllowlist.addedBy))
    .orderBy(sql`${hostAllowlist.createdAt} desc`);
  const listed = [
    ...settings.map((email) => ({
      email,
      source: "settings" as const,
      addedBy: null,
      createdAt: null,
      note: null,
    })),
    ...added
      .filter((row) => !approvedBySettings(row.email))
      .map((row) => ({ ...row, source: "admin" as const })),
  ];
  const emails = listed.map((host) => host.email);
  const accounts =
    emails.length === 0
      ? []
      : await db()
          .select({ email: sql<string>`lower(${user.email})` })
          .from(user)
          .where(inArray(sql<string>`lower(${user.email})`, emails));
  const signedUp = new Set(accounts.map((account) => account.email));
  return listed.map((host) => ({
    ...host,
    hasAccount: signedUp.has(host.email),
  }));
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
