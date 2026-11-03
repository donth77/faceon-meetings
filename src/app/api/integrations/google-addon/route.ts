import { z } from "zod";

import { addonAvailable } from "@/lib/addon/google/available";
import {
  addAddon,
  addonSetup,
  removeAddon,
  updateAddon,
} from "@/lib/addon/google/setup";
import type { AddonReply } from "@/lib/addon/google/setup-shared";
import { auth } from "@/lib/auth/server";
import { loggable } from "@/lib/log";
import { isAdmin } from "@/lib/meetings/hosting";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/same-origin";

const NO_STORE = { "cache-control": "no-store" };

const reply = (body: AddonReply) => Response.json(body, { headers: NO_STORE });

/**
 * GET /api/integrations/google-addon: where the caller's add-on stands. Settings →
 * Calendar asks again when it comes back to the front, since the add-on connects itself
 * in Google, and the desktop app while someone adds it in their browser.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  return reply({ addon: await addonSetup(session.user.id) });
}

const Body = z.object({ action: z.enum(["add", "update"]) });

/**
 * POST /api/integrations/google-addon { action }: puts the caller's own copy of the
 * add-on in their Google account ("add"), or writes the current build into it
 * ("update"). Google's consent comes first (Better Auth's linkSocial with the
 * script.projects scope); without it the answer is the "consent" problem. Where this
 * copy's Google Cloud project lacks the Apps Script API, admins also get the link that
 * turns it on.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return new Response(null, { status: 400 });
  const userId = session.user.id;
  if (!addonAvailable()) return reply({ addon: { status: "unavailable" } });
  // Each one is a couple of calls to Google, in the person's account.
  const limit = [{ key: `addon-setup:${userId}`, max: 10 }];
  if (await isLimited(limit)) return new Response(null, { status: 429 });
  await recordAttempt(limit);
  try {
    const outcome =
      body.data.action === "add"
        ? await addAddon(userId)
        : await updateAddon(userId);
    const answer: AddonReply = { addon: await addonSetup(userId) };
    if (!outcome.ok) {
      answer.problem = outcome.problem;
      if (outcome.consoleUrl && isAdmin(session.user)) {
        answer.consoleUrl = outcome.consoleUrl;
      }
    }
    return reply(answer);
  } catch (error) {
    console.error("Couldn't set up the add-on.", loggable(error));
    return new Response(null, { status: 503 });
  }
}

/**
 * DELETE /api/integrations/google-addon: FaceOn forgets the caller's add-on, stops
 * accepting it, and lets go of its access to Apps Script. Uninstalling it and deleting
 * the project are theirs to do in Google; Settings says how.
 */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  try {
    await removeAddon(session.user.id);
  } catch (error) {
    console.error("Couldn't remove the add-on.", loggable(error));
    return new Response(null, { status: 503 });
  }
  return reply({ addon: await addonSetup(session.user.id) });
}
