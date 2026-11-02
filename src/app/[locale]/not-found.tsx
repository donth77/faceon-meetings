import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  return { title: t("title") };
}

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground max-w-md">{t("body")}</p>
      <Link
        href="/"
        className="text-primary font-semibold underline-offset-4 hover:underline"
      >
        {t("home")}
      </Link>
    </main>
  );
}
