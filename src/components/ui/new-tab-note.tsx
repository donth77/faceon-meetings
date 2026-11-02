"use client";

import { useTranslations } from "next-intl";

/** Tells screen reader users that a link opens in a new tab; put it inside the link. */
export function NewTabNote() {
  const t = useTranslations("Common");
  return <span className="sr-only"> {t("newTab")}</span>;
}
