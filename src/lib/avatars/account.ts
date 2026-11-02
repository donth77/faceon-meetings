import { fallbackAvatarSeed, type AvatarUser } from "./seed";

/** Where an account's profile photo came from. */
export type PhotoProvider = "google" | "github" | "other";

/** Where a Google or GitHub profile photo came from, by its host. */
export function photoProvider(
  image: string | null | undefined,
): PhotoProvider | null {
  if (!image) return null;
  try {
    const host = new URL(image).hostname;
    if (host.endsWith(".googleusercontent.com")) return "google";
    if (host.endsWith(".githubusercontent.com")) return "github";
  } catch {
    // Not a URL; no photo to offer.
    return null;
  }
  return "other";
}

/**
 * An account's avatar, as Settings → Account and the join screen offer it: a default
 * avatar, or the photo its Google or GitHub sign-in brought.
 */
export type AccountAvatar = {
  seed: string;
  /** The photo is shown instead of the avatar. */
  usesPhoto: boolean;
  /** The sign-in provider's photo, if the account has one. */
  photo: { url: string; provider: PhotoProvider } | null;
};

export function accountAvatar(user: AvatarUser): AccountAvatar {
  const provider = photoProvider(user.image);
  return {
    seed: user.avatarSeed ?? fallbackAvatarSeed(user.id),
    usesPhoto: user.avatarSource === "provider" && Boolean(user.image),
    photo: user.image && provider ? { url: user.image, provider } : null,
  };
}
