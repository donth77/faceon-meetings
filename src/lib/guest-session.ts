import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { lookForName } from "@/lib/avatars/name-look";
import { avatarUrl, createAvatarSeed } from "@/lib/avatars/seed";
import { serverEnv } from "@/lib/server-env";
import { z } from "@/lib/zod";

/**
 * A browser's guest identity: a random ID and an avatar (a default, or the one they chose
 * on the join screen). No name, email or other personal data; guests type their name
 * each time they join.
 */
export type GuestIdentity = { id: string; avatarSeed: string };

const COOKIE = "faceon_guest";
/** Kept for 90 days after last use; every join renews it. */
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const Payload = z.object({
  v: z.literal(1),
  id: z.string().regex(/^[a-f0-9]{20}$/),
  avatarSeed: z.string().regex(/^[a-z0-9]{16}-[fmn]$/),
  /** Issued at, in seconds. */
  iat: z.number().int(),
});

function sign(payload: string): string {
  const secret = serverEnv().GUEST_SESSION_SECRET;
  if (!secret) throw new Error("GUEST_SESSION_SECRET is not set.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function encode(guest: GuestIdentity): string {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, ...guest, iat: Math.floor(Date.now() / 1000) }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** The guest identity in a cookie value, if it's genuine and not too old. */
export function decodeGuest(value: string | undefined): GuestIdentity | null {
  const [payload, signature] = value?.split(".") ?? [];
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  const parsed = Payload.safeParse(
    (() => {
      try {
        return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      } catch {
        return null;
      }
    })(),
  );
  if (!parsed.success) return null;
  const ageSeconds = Date.now() / 1000 - parsed.data.iat;
  if (ageSeconds > MAX_AGE_SECONDS) return null;
  return { id: parsed.data.id, avatarSeed: parsed.data.avatarSeed };
}

/**
 * Who joins as a guest from this browser: its guest identity, with the avatar the join
 * screen showed when it sends one. On a first visit, a new guest, with that avatar, or
 * (from an older page) a default one that suits the name they typed.
 */
export function guestForJoin(
  current: GuestIdentity | null,
  joining: { name: string; avatarSeed?: string | undefined },
): GuestIdentity {
  if (current) {
    return joining.avatarSeed
      ? { ...current, avatarSeed: joining.avatarSeed }
      : current;
  }
  return {
    id: randomBytes(10).toString("hex"),
    avatarSeed:
      joining.avatarSeed ?? createAvatarSeed(lookForName(joining.name)),
  };
}

/** Whether people may join without an account here: allowed, and the cookie can be signed. */
export function guestsEnabled(): boolean {
  const env = serverEnv();
  return env.ALLOW_GUESTS && Boolean(env.GUEST_SESSION_SECRET);
}

/** This browser's guest identity, if it has one. */
export async function currentGuest(): Promise<GuestIdentity | null> {
  if (!guestsEnabled()) return null;
  return decodeGuest((await cookies()).get(COOKIE)?.value);
}

/** Saves (or renews) the guest cookie. Route handlers and server actions only. */
export async function saveGuest(guest: GuestIdentity): Promise<void> {
  (await cookies()).set(COOKIE, encode(guest), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export const guestAvatarUrl = (guest: GuestIdentity) =>
  avatarUrl({ id: guest.id, avatarSeed: guest.avatarSeed });
