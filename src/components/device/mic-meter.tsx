"use client";

import { Mic, MicOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

const BARS = 12;

/**
 * A live level meter for the pre-join microphone. The bars are updated straight on the
 * DOM each frame, so the meter doesn't re-render React; only "Your mic is working"
 * changes state, once.
 */
export function MicMeter({ track }: { track: MediaStreamTrack | null }) {
  const t = useTranslations("PreJoin");
  const barsRef = useRef<HTMLSpanElement>(null);
  const [heardTrack, setHeardTrack] = useState<MediaStreamTrack | null>(null);
  const heard = track !== null && heardTrack === track;

  useEffect(() => {
    const bars = barsRef.current;
    if (!track || !bars) return;
    const context = new AudioContext();
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let frame = 0;

    const draw = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const level = Math.min(1, Math.sqrt(sum / samples.length) * 6);
      const lit = Math.round(level * BARS);
      bars.childNodes.forEach((bar, index) => {
        (bar as HTMLElement).dataset.lit = String(index < lit);
      });
      if (lit >= 3) setHeardTrack(track);
      frame = requestAnimationFrame(draw);
    };
    // Capture permission counts as a user gesture for audio in most browsers; resume anyway.
    void context.resume();
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      void context.close();
    };
  }, [track]);

  const Icon = track ? Mic : MicOff;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Icon
        className="text-muted-foreground size-[18px] shrink-0"
        aria-hidden="true"
      />
      <span
        ref={barsRef}
        aria-hidden="true"
        className="flex items-center gap-[3px]"
      >
        {Array.from({ length: BARS }, (_, index) => (
          <span
            key={index}
            data-lit="false"
            className="bg-border data-[lit=true]:bg-live h-3.5 w-1.5 rounded-[2px] transition-colors duration-75"
          />
        ))}
      </span>
      {/* A status, so "Your mic is working" is heard when it comes. */}
      <span role="status" className="text-muted-foreground truncate text-sm">
        {!track ? t("micOff") : heard ? t("micWorking") : t("speakToTest")}
      </span>
    </div>
  );
}
