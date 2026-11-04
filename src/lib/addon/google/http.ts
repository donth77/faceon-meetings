import "server-only";

import { createHmac } from "node:crypto";
import { unstable_rethrow } from "next/navigation";

import { reportError } from "@/lib/monitoring/report";
import { hashedClientIp, isLimited, recordAttempt } from "@/lib/rate-limit";
import { serverEnv } from "@/lib/server-env";
import { siteUrl } from "@/lib/site";
import type { z } from "@/lib/zod";

import { ADDON_ERRORS } from "./api";
import { addonAvailable } from "./available";
import { verifyAddonToken } from "./identity";
import { AddonNotFound, AddonRefusal, type AddonUser } from "./service";
import { addonFor, keepAddonCurrent } from "./setup";
import {
  ADDON_HEADERS,
  type AddonErrorBody,
  type AddonErrorCode,
} from "./types";

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
 * Origin to check: the Google identity token is what authenticates them, and it must
 * come from someone's own copy of the add-on, used from their Google account (setup.ts,
 * addonFor). Each is limited by Google account and, more loosely, by address (Google's
 * servers carry everyone's), and bad tokens are counted. A copy running an older build
 * is updated after the answer. Errors come back as AddonErrorBody.
 */
export async function handleAddonRequest(
  request: Request,
  handler: (host: AddonUser) => Promise<Response>,
): Promise<Response> {
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
    const identity = token ? await verifyAddonToken(token) : null;
    if (!identity) {
      await recordAttempt([badTokens]);
      return addonError("INVALID_TOKEN");
    }
    const byAccount = { key: `addon:sub:${hashedSub(identity.sub)}`, max: 120 };
    if (await isLimited([byAccount])) return addonError("RATE_LIMITED");
    await recordAttempt([byAccount, fromAddress]);
    const addon = addonAvailable()
      ? await addonFor(identity, request.headers.get(ADDON_HEADERS.connect))
      : null;
    if (!addon) {
      return addonError("NOT_CONNECTED", {
        link: `${siteUrl()}/settings/calendar`,
      });
    }
    await keepAddonCurrent(addon, request.headers.get(ADDON_HEADERS.version));
    return await handler(addon.host);
  } catch (error) {
    // Next.js's own signals (prerendering stops at the request's headers) aren't failures.
    unstable_rethrow(error);
    if (error instanceof AddonFailure) return addonError(error.code);
    if (error instanceof AddonNotFound) return addonError("NOT_FOUND");
    if (error instanceof AddonRefusal) {
      return addonError("PERMANENT", {
        reason: error.reason,
        link: `${siteUrl()}/help/meeting-limits`,
      });
    }
    reportError("Add-on API request failed", error);
    return addonError("TEMPORARY");
  }
}
