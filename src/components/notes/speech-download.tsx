"use client";

import { cn } from "cn";
import { Download, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useSpeechLanguage } from "@/hooks/use-speech-language";
import { downloadSpeech, useSpeechSetup } from "@/lib/notes/speech-setup";

/**
 * Transcribing you on this device, for AI notes: where this browser stands, and the
 * one-time download it may need first, so it can be done before a meeting rather than in
 * one. Settings → AI notes always shows it; pre-join shows it when the meeting has AI
 * notes on or starting by themselves, unless this browser is ready.
 */
export function SpeechDownload({
  place,
  className,
}: {
  place: "settings" | "preJoin";
  className?: string;
}) {
  const t = useTranslations("Notes.speech");
  const lang = useSpeechLanguage();
  const state = useSpeechSetup(lang);
  const [failed, setFailed] = useState(false);
  if (state === "checking") return null;
  if (place === "preJoin" && state === "available") return null;

  async function download() {
    setFailed(false);
    setFailed(!(await downloadSpeech(lang)));
  }

  const message =
    state === "available"
      ? t("ready")
      : state === "unavailable"
        ? t("unavailable")
        : state === "downloading"
          ? t(place === "preJoin" ? "downloadingPreJoin" : "downloading")
          : t(place === "preJoin" ? "neededPreJoin" : "needed");
  const offered = state === "downloadable" || state === "downloading";
  return (
    <div className={cn("flex flex-col items-start gap-3", className)}>
      <p role="status" className="max-w-[64ch] text-sm leading-normal">
        {message}
      </p>
      {offered ? (
        <Button
          variant="outline"
          isPending={state === "downloading"}
          onPress={() => void download()}
        >
          {state === "downloading" ? (
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {state === "downloading" ? t("downloadingButton") : t("download")}
        </Button>
      ) : null}
      {failed && state === "downloadable" ? (
        <p role="alert" className="text-destructive-text text-sm">
          {t("failed")}
        </p>
      ) : null}
    </div>
  );
}
