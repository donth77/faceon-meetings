import "server-only";

import { z } from "zod";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

import type { HumanCheckAction } from ".";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const Siteverify = z.object({
  success: z.boolean(),
  action: z.string().optional(),
});

/** Whether this copy checks for a person: both Turnstile keys are set. */
export function humanCheckOn(): boolean {
  return Boolean(
    publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
    serverEnv().TURNSTILE_SECRET_KEY,
  );
}

/** The secret Better Auth's captcha plugin needs, when the check is on. */
export function humanCheckSecret(): string | undefined {
  return humanCheckOn() ? serverEnv().TURNSTILE_SECRET_KEY : undefined;
}

/**
 * Asks Cloudflare whether a token is genuine, unused and made for this action. Anything
 * else, including Cloudflare not answering within 10 seconds, counts as no.
 */
export async function passedHumanCheck(input: {
  token: string | undefined;
  action: HumanCheckAction;
  /** The visitor's address, which Cloudflare uses to judge the token. */
  ip: string | null;
}): Promise<boolean> {
  const secret = serverEnv().TURNSTILE_SECRET_KEY;
  if (!secret || !input.token) return false;
  const form = new URLSearchParams({
    secret,
    response: input.token,
    idempotency_key: crypto.randomUUID(),
  });
  if (input.ip) form.set("remoteip", input.ip);
  try {
    const response = await fetch(SITEVERIFY, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result = Siteverify.safeParse(await response.json());
    return (
      result.success &&
      result.data.success &&
      (result.data.action === undefined || result.data.action === input.action)
    );
  } catch {
    return false;
  }
}
