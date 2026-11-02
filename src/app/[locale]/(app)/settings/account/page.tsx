import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { Suspense } from "react";

import { PanelLoading } from "@/components/app-shell/loading";
import { AccountSettings } from "@/components/settings/account-settings";
import { auth } from "@/lib/auth/server";
import { requireSession } from "@/lib/auth/session";
import { accountAvatar } from "@/lib/avatars/account";
import { lookForName } from "@/lib/avatars/name-look";
import { createAvatarSeed, parseAvatarSeed } from "@/lib/avatars/seed";
import { emailPasswordEnabled } from "@/lib/email/send";
import { calendarConnection } from "@/lib/google-calendar/connection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: t("section.account") };
}

export default function Page({
  searchParams,
}: PageProps<"/[locale]/settings/account">) {
  return (
    <Suspense fallback={<PanelLoading height="h-96" />}>
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
  const [accounts, calendar] = await Promise.all([
    auth.api.listUserAccounts({ headers: await headers() }),
    calendarConnection(session.user),
  ]);
  const { user } = session;
  const avatar = accountAvatar(user);
  const look = parseAvatarSeed(avatar.seed)?.look ?? lookForName(user.name);
  return (
    <AccountSettings
      account={{
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        avatar,
        methods: accounts.map(({ id, providerId }) => ({ id, providerId })),
        passwordSignIn: emailPasswordEnabled(),
        onGoogleCalendar: calendar.status === "connected",
      }}
      // Seven more avatars to pick from, made here so the page renders the same twice.
      avatarChoices={Array.from({ length: 7 }, () => createAvatarSeed(look))}
      linkError={typeof error === "string" ? error : null}
    />
  );
}
