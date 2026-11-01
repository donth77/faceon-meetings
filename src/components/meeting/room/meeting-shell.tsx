"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";

import type { DeviceProblem } from "@/lib/device/problems";
import type { AdmittedMeetingInfo, SelfInfo } from "@/lib/meetings/api";

import { useRoomMedia, type RoomStatus } from "../media";
import { useMeetingTitle } from "../meeting-title";
import { ControlBar } from "./control-bar";
import { Stage, type LayoutChoice } from "./stage";
import { TopBar } from "./top-bar";
import { useMeetingShortcuts } from "./use-meeting-shortcuts";

/** Says when the connection drops and while it comes back. */
function ConnectionBanner({ status }: { status: RoomStatus }) {
  const t = useTranslations("Meeting");
  return (
    <div role="status" className="flex justify-center px-3 empty:hidden">
      {status === "joined" ? null : (
        <p className="flex items-center gap-2 rounded-lg bg-amber-400/15 px-3 py-2 text-sm text-amber-100">
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {t(status === "offline" ? "offline" : "reconnecting")}
        </p>
      )}
    </div>
  );
}

/** A toast when the mic or camera fails to start, saying what to do, with Try again. */
function useDeviceProblemToast(
  device: "microphone" | "camera",
  problem: DeviceProblem | null,
  retry: () => Promise<void>,
) {
  const t = useTranslations("DeviceProblems");
  const tp = useTranslations("PreJoin");
  const onRetry = useEffectEvent(() => void retry());
  useEffect(() => {
    if (!problem) return;
    toast.error(t(`${device}.${problem}`), {
      action: { label: tp("tryAgain"), onClick: () => onRetry() },
    });
  }, [device, problem, t, tp]);
}

/**
 * The meeting room's layout: top bar, the stage, and the control bar. Always dark, as in
 * Zoom and Meet.
 */
export function MeetingShell({
  meeting,
  self,
  onEndForAll,
}: {
  meeting: AdmittedMeetingInfo;
  self: SelfInfo;
  onEndForAll: () => void;
}) {
  const media = useRoomMedia();
  const title = useMeetingTitle(meeting);
  const [layout, setLayout] = useState<LayoutChoice>("auto");
  useMeetingShortcuts(media);
  useDeviceProblemToast("microphone", media.mic.problem, media.mic.toggle);
  useDeviceProblemToast("camera", media.camera.problem, media.camera.toggle);

  return (
    <div
      data-fullscreen
      className="dark bg-background text-foreground flex h-dvh flex-col overflow-hidden"
    >
      <TopBar
        title={title}
        meeting={meeting}
        layout={layout}
        onLayoutChange={setLayout}
      />
      <ConnectionBanner status={media.status} />
      <main className="min-h-0 flex-1 px-3">
        <Stage layout={layout} />
      </main>
      <ControlBar
        title={title}
        isHost={self.role === "host"}
        onEndForAll={onEndForAll}
      />
    </div>
  );
}
