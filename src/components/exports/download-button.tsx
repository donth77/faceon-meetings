"use client";

import { ChevronDown, Download, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useViewerTimeZone } from "@/hooks/use-viewer-time-zone";
import { downloadBlob } from "@/lib/download";
import { fileNameFrom } from "@/lib/exports/format";

/**
 * Downloads a file the server makes for the signed-in person, with times in their time
 * zone. Says so when that fails, or when they've downloaded too often just now, rather
 * than saving an error page as the file.
 */
function useDownload() {
  const t = useTranslations("Exports");
  const timeZone = useViewerTimeZone();
  const [pending, setPending] = useState(false);

  async function download(href: string, fallbackName: string) {
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

  return { pending, download };
}

/** A button that downloads one file the server makes (see useDownload). */
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
  const { pending, download } = useDownload();
  return (
    <Button
      variant="outline"
      isPending={pending}
      onPress={() => void download(href, fallbackName)}
      className={className}
    >
      <Download aria-hidden="true" />
      {children}
    </Button>
  );
}

/** A file a Download menu offers. */
export type DownloadItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  fallbackName: string;
};

/**
 * A Download menu: one item per file that applies here, and no menu when none does.
 * A real menu button, so it opens from the keyboard and arrow keys move through it.
 */
export function DownloadMenu({
  items,
  className,
}: {
  items: DownloadItem[];
  className?: string;
}) {
  const t = useTranslations("Exports");
  const { pending, download } = useDownload();
  if (items.length === 0) return null;
  return (
    <DropdownMenuTrigger>
      <Button variant="outline" isPending={pending} className={className}>
        <Download aria-hidden="true" />
        {t("download")}
        <ChevronDown aria-hidden="true" className="-ml-0.5 size-4" />
      </Button>
      <DropdownMenu
        placement="bottom end"
        className="min-w-60"
        onAction={(key) => {
          const item = items.find((candidate) => candidate.id === key);
          if (item) void download(item.href, item.fallbackName);
        }}
      >
        {items.map(({ id, label, icon: Icon }) => (
          <DropdownMenuItem key={id} id={id} textValue={label}>
            <Icon aria-hidden="true" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}
