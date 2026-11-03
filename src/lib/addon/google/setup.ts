import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { and, eq, isNull, lt, or, type SQL } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/lib/db";
import { googleAddon, user } from "@/lib/db/schema";
import { publicEnv } from "@/lib/env";
import {
  googleAccess,
  hasGoogleGrant,
  releaseScriptAccess,
} from "@/lib/google-calendar/connection";
import { GOOGLE_SCRIPT_SCOPE } from "@/lib/google-calendar/shared";
import { loggable } from "@/lib/log";
import { isUniqueViolation } from "@/lib/meetings/queries";
import { serverEnv } from "@/lib/server-env";
import { siteUrl } from "@/lib/site";

import {
  createProject,
  updateContent,
  type ScriptProblem,
  type ScriptResult,
} from "./apps-script";
import { addonAvailable } from "./available";
import { ADDON_BUNDLE } from "./bundle";
import { addonFiles, conferenceLogo, type ScriptFile } from "./content";
import type { GoogleIdentity } from "./identity";
import type { AddonUser } from "./service";
import { ownerOf, shouldUpdate, UPDATE_RETRY_MS } from "./setup-rules";
import type { AddonProblem, AddonSetup } from "./setup-shared";

/*
 * Adding FaceOn to someone's Google Calendar and Gmail: FaceOn makes them their own copy
 * of the add-on, an Apps Script project in their Google account, through the Apps Script
 * API with their permission (the script.projects scope, asked like Calendar sync's), and
 * keeps its code current. Google's editor installs it (one click; outside the Marketplace
 * there's no other way). The copy connects itself the first time it's used.
 */

/** The add-on's files, made for this FaceOn, with a connect token or none. */
function filesFor(connectToken: string): ScriptFile[] {
  const url = siteUrl();
  const name = publicEnv.NEXT_PUBLIC_APP_NAME;
  const icon = `${url}/icons/icon-192.png`;
  const copy = {
    url,
    name,
    logoUrl: icon,
    conferenceLogoUrl: conferenceLogo({
      name,
      own: serverEnv().GOOGLE_ADDON_CONFERENCE_LOGO_URL,
      icon,
    }),
  };
  return addonFiles(ADDON_BUNDLE, copy, {
    url,
    name,
    version: ADDON_BUNDLE.version,
    connectToken,
  });
}

const newConnectToken = () => randomBytes(32).toString("base64url");

/** A connect token as it's kept: a keyed hash, never the token. */
function hashOf(connectToken: string): string {
  return createHmac("sha256", serverEnv().BETTER_AUTH_SECRET ?? "")
    .update(`addon-connect:${connectToken}`)
    .digest("base64url");
}

/** What adding or updating it did. */
export type SetupOutcome =
  | { ok: true }
  | { ok: false; problem: AddonProblem; consoleUrl?: string | null };

function failure(problem: ScriptProblem): SetupOutcome & { ok: false } {
  switch (problem.kind) {
    case "auth":
      return { ok: false, problem: "consent" };
    case "serviceDisabled":
      return {
        ok: false,
        problem: "serviceDisabled",
        consoleUrl: problem.consoleUrl,
      };
    default:
      return { ok: false, problem: problem.kind };
  }
}

/**
 * Runs an Apps Script call with the person's Google token for the scope (from the
 * Google account `googleSub`, when given), refreshing it once if Google refuses one that
 * looked valid.
 */
async function withScriptAccess<T>(
  userId: string,
  task: (accessToken: string) => Promise<ScriptResult<T>>,
  googleSub?: string,
): Promise<
  { ok: true; value: T; googleSub: string } | (SetupOutcome & { ok: false })
> {
  const refused = (problem: "reconnect" | "failed") =>
    ({
      ok: false,
      problem: problem === "reconnect" ? "consent" : "failed",
    }) as const;
  let access = await googleAccess(userId, GOOGLE_SCRIPT_SCOPE, { googleSub });
  if (!access.ok) return refused(access.problem);
  let result = await task(access.accessToken);
  if (!result.ok && result.problem.kind === "auth") {
    access = await googleAccess(userId, GOOGLE_SCRIPT_SCOPE, {
      googleSub,
      fresh: true,
    });
    if (!access.ok) return refused(access.problem);
    result = await task(access.accessToken);
  }
  return result.ok
    ? { ok: true, value: result.value, googleSub: access.googleSub }
    : failure(result.problem);
}

/** Where someone's add-on stands. */
export async function addonSetup(userId: string): Promise<AddonSetup> {
  if (!addonAvailable()) return { status: "unavailable" };
  const [row] = await db()
    .select({
      scriptId: googleAddon.scriptId,
      clientId: googleAddon.clientId,
      updateRefusedAt: googleAddon.updateRefusedAt,
    })
    .from(googleAddon)
    .where(eq(googleAddon.userId, userId));
  if (!row) {
    return {
      status: "none",
      granted: await hasGoogleGrant(userId, GOOGLE_SCRIPT_SCOPE),
    };
  }
  return {
    status: row.clientId ? "connected" : "created",
    scriptId: row.scriptId,
    needsUpdate: row.updateRefusedAt !== null,
  };
}

/**
 * Makes the person's own copy: a new Apps Script project in their Google account,
 * named after this FaceOn, with the add-on in it and a token it connects with. Adding
 * it again makes a new one; FaceOn then forgets the old.
 */
export async function addAddon(userId: string): Promise<SetupOutcome> {
  const created = await withScriptAccess(userId, (accessToken) =>
    createProject(accessToken, publicEnv.NEXT_PUBLIC_APP_NAME),
  );
  if (!created.ok) return created;
  const { scriptId } = created.value;
  const connectToken = newConnectToken();
  const written = await withScriptAccess(
    userId,
    (accessToken) =>
      updateContent(accessToken, scriptId, filesFor(connectToken)),
    created.googleSub,
  );
  if (!written.ok) return written;
  const now = new Date();
  const values = {
    scriptId,
    googleSub: created.googleSub,
    clientId: null,
    connectTokenHash: hashOf(connectToken),
    version: ADDON_BUNDLE.version,
    createdAt: now,
    updatedAt: now,
    connectedAt: null,
    updateTriedAt: null,
    updateRefusedAt: null,
  };
  await db()
    .insert(googleAddon)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: googleAddon.userId, set: values });
  return { ok: true };
}

/**
 * Writes the current build into the person's add-on. One that hasn't connected yet gets
 * a new connect token with it. When Google refuses, Settings offers to update it, which
 * asks Google again.
 */
export async function updateAddon(userId: string): Promise<SetupOutcome> {
  const [row] = await db()
    .select()
    .from(googleAddon)
    .where(eq(googleAddon.userId, userId));
  if (!row) return { ok: false, problem: "missing" };
  const connectToken = row.clientId ? "" : newConnectToken();
  const written = await withScriptAccess(
    userId,
    (accessToken) =>
      updateContent(accessToken, row.scriptId, filesFor(connectToken)),
    row.googleSub,
  );
  const now = new Date();
  if (written.ok) {
    await db()
      .update(googleAddon)
      .set({
        version: ADDON_BUNDLE.version,
        updatedAt: now,
        updateTriedAt: now,
        updateRefusedAt: null,
        ...(row.clientId ? {} : { connectTokenHash: hashOf(connectToken) }),
      })
      .where(eq(googleAddon.userId, userId));
    return { ok: true };
  }
  // Only the person can change these; anything else is tried again later.
  const refused = written.problem !== "failed";
  await db()
    .update(googleAddon)
    .set({ updateTriedAt: now, ...(refused ? { updateRefusedAt: now } : {}) })
    .where(eq(googleAddon.userId, userId));
  return written;
}

/**
 * Removes the add-on from FaceOn: it stops accepting its requests, and lets go of its
 * access to Apps Script. The project stays in their Google account until they delete it.
 */
export async function removeAddon(userId: string): Promise<void> {
  await db().delete(googleAddon).where(eq(googleAddon.userId, userId));
  await releaseScriptAccess(userId);
}

/** Google is removed from someone's account: their add-on in it goes too. */
export async function forgetAddonOf(removed: {
  userId: string;
  accountId: string;
}): Promise<void> {
  await db()
    .delete(googleAddon)
    .where(
      and(
        eq(googleAddon.userId, removed.userId),
        eq(googleAddon.googleSub, removed.accountId),
      ),
    );
}

/** A person's add-on, as a request finds it. */
export type ConnectedAddon = {
  host: AddonUser;
  updateTriedAt: Date | null;
  updateRefusedAt: Date | null;
};

async function addonWhere(where: SQL | undefined) {
  const [row] = await db()
    .select({
      userId: googleAddon.userId,
      googleSub: googleAddon.googleSub,
      updateTriedAt: googleAddon.updateTriedAt,
      updateRefusedAt: googleAddon.updateRefusedAt,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
    })
    .from(googleAddon)
    .innerJoin(user, eq(user.id, googleAddon.userId))
    .where(where)
    .limit(1);
  return row ?? null;
}

const connected = (
  row: NonNullable<Awaited<ReturnType<typeof addonWhere>>>,
): ConnectedAddon => ({
  host: {
    id: row.userId,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
  },
  updateTriedAt: row.updateTriedAt,
  updateRefusedAt: row.updateRefusedAt,
});

/**
 * Whose add-on a request comes from (setup-rules.ts, ownerOf): the identity token's
 * client (`audience`) is a copy FaceOn made, used from its owner's Google account. A new
 * copy connects here, with its token. Null for anyone else's.
 */
export async function addonFor(
  identity: GoogleIdentity,
  connectToken: string | null,
): Promise<ConnectedAddon | null> {
  const byClient = await addonWhere(
    eq(googleAddon.clientId, identity.audience),
  );
  const hash = !byClient && connectToken ? hashOf(connectToken) : null;
  const byToken = hash
    ? await addonWhere(
        and(
          eq(googleAddon.connectTokenHash, hash),
          isNull(googleAddon.clientId),
        ),
      )
    : null;
  const owner = ownerOf({ sub: identity.sub, byClient, byToken });
  if (!owner) return null;
  if (!owner.connects) return byClient && connected(byClient);
  if (!byToken || !hash) return null;
  try {
    const [done] = await db()
      .update(googleAddon)
      .set({
        clientId: identity.audience,
        connectTokenHash: null,
        connectedAt: new Date(),
      })
      .where(
        and(
          eq(googleAddon.userId, owner.userId),
          eq(googleAddon.connectTokenHash, hash),
          isNull(googleAddon.clientId),
        ),
      )
      .returning({ userId: googleAddon.userId });
    if (done) return connected(byToken);
  } catch (error) {
    // Another person's add-on has this client already: not this one's.
    if (isUniqueViolation(error)) return null;
    throw error;
  }
  // A request alongside connected it first.
  const now = await addonWhere(eq(googleAddon.clientId, identity.audience));
  return now?.userId === owner.userId ? connected(now) : null;
}

/**
 * Keeps an add-on current: when it reports an older build, FaceOn writes the current
 * one after answering. Test deployments run the latest code, so the next use has it.
 * Requests arriving together update it once.
 */
export async function keepAddonCurrent(
  addon: ConnectedAddon,
  reported: string | null,
): Promise<void> {
  const now = new Date();
  const due = shouldUpdate({
    reported,
    current: ADDON_BUNDLE.version,
    refusedAt: addon.updateRefusedAt,
    triedAt: addon.updateTriedAt,
    now,
  });
  if (!due) return;
  const since = new Date(now.getTime() - UPDATE_RETRY_MS);
  const [claimed] = await db()
    .update(googleAddon)
    .set({ updateTriedAt: now })
    .where(
      and(
        eq(googleAddon.userId, addon.host.id),
        or(
          isNull(googleAddon.updateTriedAt),
          lt(googleAddon.updateTriedAt, since),
        ),
      ),
    )
    .returning({ userId: googleAddon.userId });
  if (!claimed) return;
  after(async () => {
    try {
      await updateAddon(addon.host.id);
    } catch (error) {
      console.error("Couldn't update an add-on.", loggable(error));
    }
  });
}
