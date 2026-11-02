import "server-only";

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

import {
  challengeMatches,
  HANDOFF_TTL_MS,
  handoffKey,
  HandoffRecord,
  newHandoffToken,
  readHandoff,
} from "@/lib/desktop/handoff";
import { CHALLENGE } from "@/lib/desktop/handoff-params";

/** Back to the app's sign-in page, saying only that it didn't work. */
const FAILED = "/desktop/sign-in?error=expired";

function readRecord(value: string) {
  try {
    const parsed = HandoffRecord.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Signing the desktop app in through the browser (lib/desktop/handoff.ts).
 * - POST /desktop/handoff, from the signed-in browser: a one-time token for the app's
 *   challenge, kept a minute.
 * - GET /desktop/session, from the app's window with the token and the verifier in a
 *   header: a session of the window's own, so signing out in the app leaves the browser
 *   signed in, and the reverse.
 */
export const desktopHandoff = () =>
  ({
    id: "desktop-handoff",
    endpoints: {
      desktopHandoff: createAuthEndpoint(
        "/desktop/handoff",
        {
          method: "POST",
          use: [sessionMiddleware],
          body: z.object({ challenge: z.string().regex(CHALLENGE) }),
        },
        async (ctx) => {
          const token = newHandoffToken();
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: handoffKey(token),
            value: JSON.stringify({
              userId: ctx.context.session.user.id,
              challenge: ctx.body.challenge,
            }),
            expiresAt: new Date(Date.now() + HANDOFF_TTL_MS),
          });
          return ctx.json({ token });
        },
      ),
      desktopSession: createAuthEndpoint(
        "/desktop/session",
        { method: "GET" },
        async (ctx) => {
          const handoff = readHandoff(ctx.headers?.get("x-faceon-handoff"));
          if (!handoff) throw ctx.redirect(FAILED);
          const stored =
            await ctx.context.internalAdapter.consumeVerificationValue(
              handoffKey(handoff.token),
            );
          if (!stored || stored.expiresAt < new Date()) {
            throw ctx.redirect(FAILED);
          }
          const record = readRecord(stored.value);
          if (
            !record ||
            !challengeMatches(record.challenge, handoff.verifier)
          ) {
            throw ctx.redirect(FAILED);
          }
          const user = await ctx.context.internalAdapter.findUserById(
            record.userId,
          );
          if (!user) throw ctx.redirect(FAILED);
          const session = await ctx.context.internalAdapter.createSession(
            user.id,
          );
          await setSessionCookie(ctx, { session, user });
          throw ctx.redirect("/home");
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
