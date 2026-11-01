import "server-only";

import { auth } from "@/lib/auth/server";
import { avatarUrl } from "@/lib/avatars/seed";

/** Who is calling a meeting API. Guests arrive with guest sessions. */
export type Principal = {
  kind: "user";
  userId: string;
  /** Their identity with the media provider. */
  mediaUserId: string;
  name: string;
  image: string;
};

/** The media identity of a signed-in user. */
export const userMediaId = (userId: string) => `u_${userId}`;

export async function getPrincipal(
  request: Request,
): Promise<Principal | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const { user } = session;
  return {
    kind: "user",
    userId: user.id,
    mediaUserId: userMediaId(user.id),
    name: user.name,
    image: avatarUrl(user),
  };
}
