"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { reportBrowserError } from "@/lib/monitoring/browser-errors";

/** A Server Component's error arrives with a digest: the server has reported it already. */
function fromServer(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string"
  );
}

/**
 * What a page shows in its own place when it breaks while showing: try again, or go home.
 * Errors from the browser are reported here, since an error page catches them before the
 * browser's handlers could; the server reports its own.
 */
export default function PageError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const t = useTranslations("PageError");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!fromServer(error)) reportBrowserError(error);
  }, [error]);

  // The page's content just went: keep keyboard and screen reader users in place.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1
          ref={heading}
          tabIndex={-1}
          className="font-display text-3xl font-bold outline-hidden"
        >
          {t("title")}
        </h1>
        <p className="text-muted-foreground max-w-md">{t("body")}</p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
          <Button
            onPress={retry}
            className="h-10 rounded-xl px-4 text-sm font-semibold"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("retry")}
          </Button>
          <Link
            href="/"
            className="text-primary focus-visible:focus-ring rounded font-semibold underline-offset-4 outline-hidden hover:underline"
          >
            {t("home")}
          </Link>
        </div>
      </div>
    </main>
  );
}
