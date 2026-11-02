import "server-only";

import { auth } from "@/lib/auth/server";
import { avatarUrl } from "@/lib/avatars/seed";
import {
  currentGuest,
  guestAvatarUrl,
  type GuestIdentity,
} from "@/lib/guest-session";

/** Who is calling a meeting API: someone signed in, or a guest with this browser's guest ID. */
export type Principal =
  | {
      kind: "user";
      userId: string;
      /** Their identity with the media provider. */
      mediaUserId: string;
      name: string;
      image: string;
      /** Their address once verified (lowercased), which named co-hosts are matched on. */
      verifiedEmail: string | null;
    }
  | {
      kind: "guest";
      guest: GuestIdentity;
      mediaUserId: string;
      image: string;
    };

/** Media identities: "u_<userId>" when signed in, "g_<guestId>" for guests. */
export const userMediaId = (userId: string) => `u_${userId}`;
export const guestMediaId = (guestId: string) => `g_${guestId}`;

export function guestPrincipal(guest: GuestIdentity): Principal {
  return {
    kind: "guest",
    guest,
    mediaUserId: guestMediaId(guest.id),
    image: guestAvatarUrl(guest),
  };
}

/** The signed-in user if there is one, otherwise this browser's guest identity. */
export async function getPrincipal(
  request: Request,
): Promise<Principal | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session) {
    const { user } = session;
    return {
      kind: "user",
      userId: user.id,
      mediaUserId: userMediaId(user.id),
      name: user.name,
      image: avatarUrl(user),
      verifiedEmail: user.emailVerified ? user.email.toLowerCase() : null,
    };
  }
  const guest = await currentGuest();
  return guest ? guestPrincipal(guest) : null;
}
