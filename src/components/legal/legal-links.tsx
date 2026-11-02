import { cn } from "cn";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";

import { NewTabNote } from "@/components/ui/new-tab-note";

/**
 * Links to the terms and the privacy policy for `t.rich`'s <terms> and <privacy> tags.
 * They open in a new tab, so what the person was doing (a half-filled form, a camera
 * preview) stays as it was.
 */
export const LEGAL_LINKS = {
  terms: (chunks: ReactNode) => <LegalLink href="/terms">{chunks}</LegalLink>,
  privacy: (chunks: ReactNode) => (
    <LegalLink href="/privacy">{chunks}</LegalLink>
  ),
};

function LegalLink({
  href,
  children,
}: {
  href: "/terms" | "/privacy";
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener"
      className="hover:text-foreground focus-visible:focus-ring rounded-[2px] underline underline-offset-4 outline-hidden"
    >
      {children}
      <NewTabNote />
    </Link>
  );
}

/**
 * "By joining, you agree to the Terms and acknowledge the Privacy Policy", under the
 * button that creates an account or joins a meeting.
 */
export function LegalConsent({
  action,
  className,
}: {
  action: "signUp" | "signIn" | "join";
  className?: string;
}) {
  const t = useTranslations("Legal.consent");
  return (
    <p
      className={cn(
        "text-muted-foreground text-[13px] leading-normal",
        className,
      )}
    >
      {t.rich(action, LEGAL_LINKS)}
    </p>
  );
}
