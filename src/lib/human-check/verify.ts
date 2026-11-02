import "server-only";

import { z } from "zod";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import { siteUrl } from "@/lib/site";

import type { HumanCheckAction } from ".";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const Siteverify = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  /** Where the check was passed. */
  hostname: z.string().optional(),
});

/** Cloudflare's test secrets (always pass, always fail, already used) answer for any page. */
const TEST_SECRET = /^[123]x0+AA$/;

/**
 * Where a token may come from: this copy's own address, plus any in TURNSTILE_HOSTNAMES
 * (a comma-separated list, for another domain the same widget serves).
 */
export function allowedHostnames(): string[] {
  const extra = (serverEnv().TURNSTILE_HOSTNAMES ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  return [new URL(siteUrl()).hostname, ...extra];
}

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
 * Asks Cloudflare whether a token is genuine, unused, made for this action and passed on
 * one of this copy's own pages. Anything else, including Cloudflare not answering within
 * 10 seconds, counts as no.
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
    if (!result.success || !result.data.success) return false;
    const { action, hostname } = result.data;
    if (action !== undefined && action !== input.action) return false;
    return (
      TEST_SECRET.test(secret) ||
      (hostname !== undefined &&
        allowedHostnames().includes(hostname.toLowerCase()))
    );
  } catch {
    return false;
  }
}
