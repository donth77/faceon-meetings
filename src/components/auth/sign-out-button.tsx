"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";

export function SignOutButton() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <Button variant="outline" isPending={pending} onPress={handleSignOut}>
      {t("signOut")}
    </Button>
  );
}
