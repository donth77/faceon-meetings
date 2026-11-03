/**
 * The add-on's rules, without the database: whose add-on a request comes from, and
 * when FaceOn updates one.
 */
import { DEV_VERSION } from "./content";

/** An add-on FaceOn made: whose it is, and the Google account it's in. */
export type AddonOwner = { userId: string; googleSub: string };

/**
 * Whose add-on a request comes from. Google signs who's asking (`sub`) and for which
 * add-on (its OAuth client). A client FaceOn knows belongs to one person and works only
 * for their Google account, so a copy shared with someone else doesn't work for them.
 * An unknown client is someone's new copy, connecting with the one-time token FaceOn
 * wrote into it, from the Google account it was made in. Null: not anyone's.
 */
export function ownerOf(request: {
  sub: string;
  /** The add-on whose client this is, if FaceOn knows it. */
  byClient: AddonOwner | null;
  /** The not yet connected add-on whose connect token came with the request. */
  byToken: AddonOwner | null;
}): (AddonOwner & { connects: boolean }) | null {
  const { sub, byClient, byToken } = request;
  if (byClient) {
    return byClient.googleSub === sub ? { ...byClient, connects: false } : null;
  }
  if (byToken?.googleSub === sub) return { ...byToken, connects: true };
  return null;
}

/** How long a background update that didn't get through waits before another try. */
export const UPDATE_RETRY_MS = 30 * 60_000;

/**
 * Whether FaceOn writes its current build into an add-on that just reported its own.
 * Never a developer's build; not while Google refuses (the person has to allow it
 * again); and at most once per UPDATE_RETRY_MS.
 */
export function shouldUpdate(input: {
  reported: string | null;
  current: string;
  refusedAt: Date | null;
  triedAt: Date | null;
  now: Date;
}): boolean {
  const { reported, current, refusedAt, triedAt, now } = input;
  if (!reported || reported === DEV_VERSION || reported === current) {
    return false;
  }
  if (refusedAt) return false;
  return !triedAt || now.getTime() - triedAt.getTime() >= UPDATE_RETRY_MS;
}
