import "server-only";

import { createHmac } from "node:crypto";
import type { z } from "zod";

import { loggable } from "@/lib/log";
import { hashedClientIp, isLimited, recordAttempt } from "@/lib/rate-limit";
import { serverEnv } from "@/lib/server-env";
import { siteUrl } from "@/lib/site";

import { ADDON_ERRORS } from "./api";
import { verifyAddonToken } from "./identity";
import {
  AddonNotFound,
  AddonRefusal,
  userForGoogleSub,
  type AddonUser,
} from "./service";
import type { AddonErrorBody, AddonErrorCode } from "./types";

/** A request the add-on API turns down, with its error. */
export class AddonFailure extends Error {
  constructor(readonly code: AddonErrorCode) {
    super(code);
  }
}

export function addonError(
  code: AddonErrorCode,
  extra: Omit<AddonErrorBody["error"], "code"> = {},
): Response {
  const body: AddonErrorBody = { error: { code, ...extra } };
  return Response.json(body, { status: ADDON_ERRORS[code] });
}

/** The request's JSON body, checked; anything else is a BAD_REQUEST. */
export async function readAddonJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) throw new AddonFailure("BAD_REQUEST");
  return parsed.data;
}

/** A Google account's ID as a keyed hash, for the rate limit's counter. */
function hashedSub(sub: string): string {
  return createHmac("sha256", serverEnv().BETTER_AUTH_SECRET ?? "")
    .update(`addon:${sub}`)
    .digest("base64url")
    .slice(0, 22);
}

/**
 * Runs an add-on API request. Requests come from Google's servers, so there's no
 * Origin to check: the Google identity token is what authenticates them. Each is
 * limited by Google account and, more loosely, by address (Google's servers carry
 * everyone's), and bad tokens are counted. Errors come back as AddonErrorBody.
 */
export async function handleAddonRequest(
  request: Request,
  handler: (host: AddonUser) => Promise<Response>,
): Promise<Response> {
  const audience = serverEnv().GOOGLE_ADDON_CLIENT_ID;
  if (!audience) return addonError("NOT_AVAILABLE");
  try {
    const ip = hashedClientIp(request);
    const badTokens = { key: `addon:bad:${ip}`, max: 40 };
    const fromAddress = { key: `addon:ip:${ip}`, max: 5000 };
    if (await isLimited([badTokens, fromAddress])) {
      return addonError("RATE_LIMITED");
    }
    const token = /^Bearer (\S+)$/.exec(
      request.headers.get("authorization") ?? "",
    )?.[1];
    const identity = token ? await verifyAddonToken(token, audience) : null;
    if (!identity) {
      await recordAttempt([badTokens]);
      return addonError("INVALID_TOKEN");
    }
    const byAccount = { key: `addon:sub:${hashedSub(identity.sub)}`, max: 120 };
    if (await isLimited([byAccount])) return addonError("RATE_LIMITED");
    await recordAttempt([byAccount, fromAddress]);
    const host = await userForGoogleSub(identity.sub);
    if (!host) {
      return addonError("AUTHENTICATION", {
        link: `${siteUrl()}/sign-in?next=${encodeURIComponent("/settings/calendar")}`,
      });
    }
    return await handler(host);
  } catch (error) {
    if (error instanceof AddonFailure) return addonError(error.code);
    if (error instanceof AddonNotFound) return addonError("NOT_FOUND");
    if (error instanceof AddonRefusal) {
      return addonError("PERMANENT", {
        reason: error.reason,
        link: `${siteUrl()}/help/meeting-limits`,
      });
    }
    console.error("Add-on API request failed", loggable(error));
    return addonError("TEMPORARY");
  }
}
