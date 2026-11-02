import { getTranslations } from "next-intl/server";
import Link from "next/link";

/**
 * "Page not found" and a way home: the not-found page's content, and what a signed-in
 * page shows in its own place when what it was asked for isn't there or isn't yours.
 * Those pages decide after streaming has begun, where calling notFound() makes React
 * switch the section to rendering in the browser, and production builds log error #419.
 */
export async function NotFoundContent({
  heading: Heading = "h1",
}: {
  /** h2 inside a page that has its own h1 (Settings). */
  heading?: "h1" | "h2";
}) {
  const t = await getTranslations("NotFound");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Heading className="font-display text-3xl font-bold">
        {t("title")}
      </Heading>
      <p className="text-muted-foreground max-w-md">{t("body")}</p>
      <Link
        href="/"
        className="text-primary focus-visible:focus-ring rounded font-semibold underline-offset-4 outline-hidden hover:underline"
      >
        {t("home")}
      </Link>
    </div>
  );
}
