"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useViewerTimeZone } from "@/hooks/use-viewer-time-zone";
import { downloadBlob } from "@/lib/download";
import { fileNameFrom } from "@/lib/exports/format";

/**
 * A button that downloads a file the server makes for the signed-in person, with times
 * in their time zone. It says so when that fails, or when they've downloaded it too often
 * just now, rather than saving an error page as the file.
 */
export function DownloadButton({
  href,
  fallbackName,
  className,
  children,
}: {
  /** The route that makes the file; `?tz=` is added. */
  href: string;
  /** The file's name if the server gives none. */
  fallbackName: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("Exports");
  const timeZone = useViewerTimeZone();
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    try {
      const url = new URL(href, window.location.origin);
      url.searchParams.set("tz", timeZone);
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) {
        toast.error(t(response.status === 429 ? "tooMany" : "failed"));
        return;
      }
      downloadBlob(
        await response.blob(),
        fileNameFrom(response.headers.get("content-disposition")) ??
          fallbackName,
      );
    } catch {
      toast.error(t("failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      isPending={pending}
      onPress={() => void download()}
      className={className}
    >
      <Download aria-hidden="true" />
      {children}
    </Button>
  );
}
