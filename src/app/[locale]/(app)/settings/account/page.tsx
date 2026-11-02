import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { Suspense } from "react";

import {
  AccountSettings,
  type PhotoProvider,
} from "@/components/settings/account-settings";
import { auth } from "@/lib/auth/server";
import { requireSession } from "@/lib/auth/session";
import {
  createAvatarSeed,
  fallbackAvatarSeed,
  parseAvatarSeed,
} from "@/lib/avatars/seed";
import { emailPasswordEnabled } from "@/lib/email/send";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: t("section.account") };
}

/** Where a Google or GitHub profile photo came from, by its host. */
function photoProvider(image: string | null | undefined): PhotoProvider | null {
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

export default function Page({
  searchParams,
}: PageProps<"/[locale]/settings/account">) {
  return (
    <Suspense fallback={<div className="min-h-60" aria-busy="true" />}>
      <Account searchParams={searchParams} />
    </Suspense>
  );
}

/** Settings → Account, for the signed-in user. */
async function Account({
  searchParams,
}: Pick<PageProps<"/[locale]/settings/account">, "searchParams">) {
  const session = await requireSession("/settings/account");
  const { error } = await searchParams;
  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  });
  const { user } = session;
  const seed = user.avatarSeed ?? fallbackAvatarSeed(user.id);
  const look = parseAvatarSeed(seed)?.look;
  return (
    <AccountSettings
      account={{
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        photo: user.image ?? null,
        photoProvider: photoProvider(user.image),
        usesPhoto: user.avatarSource === "provider" && Boolean(user.image),
        avatarSeed: seed,
        methods: accounts.map(({ id, providerId }) => ({ id, providerId })),
        passwordSignIn: emailPasswordEnabled(),
      }}
      // Seven more avatars to pick from, made here so the page renders the same twice.
      avatarChoices={Array.from({ length: 7 }, () =>
        createAvatarSeed(user.name, look),
      )}
      linkError={typeof error === "string" ? error : null}
    />
  );
}
