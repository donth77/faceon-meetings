"use client";

import { useTranslations } from "next-intl";

import { LinkButton } from "@/components/ui/button";

/** "Sign in" in the meeting pages' header, for guests. */
export function SignInLink({ href }: { href: string }) {
  const t = useTranslations("Landing");
  return (
    <LinkButton
      href={href}
      variant="ghost"
      className="h-10 rounded-[10px] px-3.5 text-[15px] font-semibold"
    >
      {t("signIn")}
    </LinkButton>
  );
}
