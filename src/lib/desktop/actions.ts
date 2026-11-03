"use server";

import { getSession } from "@/lib/auth/session";

import { noteDesktopAppUsed } from "./usage";

/** Home, inside the desktop app: this account uses it (lib/desktop/usage.ts). */
export async function noteDesktopAppAction(): Promise<void> {
  const session = await getSession();
  if (session) await noteDesktopAppUsed(session.user.id);
}
