"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { DeviceProblem } from "@/lib/device/problems";
import type {
  AdmittedMeetingInfo,
  SelfInfo,
  SessionInfo,
} from "@/lib/meetings/api";

import { meetingApi } from "../api-client";
import { useRoomMedia, type RoomStatus } from "../media";
import { useMeetingTitle } from "../meeting-title";
import { AloneCard } from "./alone-card";
import { AloneCheckDialog, useAloneCheck } from "./alone-check";
import { ChatPanel } from "./chat-panel";
import { ControlBar, type PanelName } from "./control-bar";
import { ParticipantsPanel } from "./participants-panel";
import { FloatingReactions } from "./reactions";
import { RoomBadgesProvider } from "./room-badges";
import { Stage, type LayoutChoice } from "./stage";
import { TopBar } from "./top-bar";
import { useChat } from "./use-chat";
import { useMeetingShortcuts } from "./use-meeting-shortcuts";
import { useReactions, useReactionSender } from "./use-reactions";

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
  session,
  endsAt,
  onEndForAll,
  onAloneTimeout,
}: {
  meeting: AdmittedMeetingInfo;
  self: SelfInfo;
  session: SessionInfo;
  /** When the session's time limit runs out, on this device's clock. */
  endsAt: number | null;
  onEndForAll: () => void;
  /** Called before leaving because nobody else was here. */
  onAloneTimeout: () => void;
}) {
  const t = useTranslations("Meeting");
  const media = useRoomMedia();
  const title = useMeetingTitle(meeting);
  const [layout, setLayout] = useState<LayoutChoice>("auto");
  const [panel, setPanel] = useState<PanelName | null>(null);
  const chat = useChat({
    media,
    self,
    isOpen: panel === "chat",
    // A preview of each new message while the chat panel is closed, as in both apps.
    onPreview: (message) =>
      toast(message.senderName, {
        description: message.text,
        action: { label: t("chat.open"), onClick: () => openPanel("chat") },
      }),
  });

  // Raised hands and reactions.
  const isHost = self.role === "host" || self.role === "cohost";
  const hands = useMemo(
    () => media.sessionState?.hands ?? {},
    [media.sessionState],
  );
  const reactionsAllowed = media.sessionState?.reactions ?? true;
  const reactions = useReactions(media.subscribeReactions, reactionsAllowed);
  const sendReaction = useReactionSender(media.sendReaction);
  const badges = useMemo(
    () => ({
      hands,
      reactions: new Map(reactions.map((r) => [r.userId, r.code] as const)),
    }),
    [hands, reactions],
  );
  const nameOf = (userId: string) =>
    media.participants.find((p) => p.userId === userId)?.name ?? "";

  async function changeHand(
    request: Parameters<typeof meetingApi.hand>[1],
  ): Promise<void> {
    try {
      await meetingApi.hand(meeting.code, request);
    } catch {
      toast.error(t("hand.failed"));
    }
  }

  // Hosts hear about each hand that goes up.
  const previousHands = useRef(hands);
  const announceHand = useEffectEvent((userId: string) => {
    if (isHost && userId !== self.id) {
      toast(t("hand.someoneRaised", { name: nameOf(userId) }));
    }
  });
  useEffect(() => {
    const before = previousHands.current;
    previousHands.current = hands;
    for (const userId of Object.keys(hands)) {
      if (!(userId in before)) announceHand(userId);
    }
  }, [hands]);

  function openPanel(next: PanelName) {
    setPanel(next);
    if (next === "chat") chat.markRead();
  }

  function togglePanel(next: PanelName) {
    if (panel === next) setPanel(null);
    else openPanel(next);
  }
  useMeetingShortcuts(media);
  const alone = media.participants.length === 1;
  const aloneCheck = useAloneCheck(alone, session.aloneTimeoutMinutes);
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
        session={session}
        endsAt={endsAt}
        layout={layout}
        onLayoutChange={setLayout}
      />
      <ConnectionBanner status={media.status} />
      <div className="flex min-h-0 flex-1 gap-3 px-3">
        <main className="relative min-h-0 min-w-0 flex-1">
          <RoomBadgesProvider value={badges}>
            <Stage layout={layout} />
          </RoomBadgesProvider>
          <FloatingReactions reactions={reactions} nameOf={nameOf} />
          {alone ? <AloneCard meeting={meeting} /> : null}
        </main>
        {panel === "people" ? (
          <ParticipantsPanel
            meeting={meeting}
            hands={hands}
            isHost={isHost}
            onLowerHand={(userId) =>
              void changeHand({ raised: false, target: userId })
            }
            onLowerAll={() => void changeHand({ lowerAll: true })}
            onClose={() => setPanel(null)}
          />
        ) : panel === "chat" ? (
          <ChatPanel
            messages={chat.messages}
            onSend={chat.send}
            onClose={() => setPanel(null)}
          />
        ) : null}
      </div>
      <AloneCheckDialog
        askedAt={aloneCheck.askedAt}
        minutes={session.aloneTimeoutMinutes ?? 0}
        onStay={aloneCheck.stay}
        onLeave={() => {
          onAloneTimeout();
          void media.leave();
        }}
      />
      <ControlBar
        title={title}
        isHost={self.role === "host"}
        onEndForAll={onEndForAll}
        panel={panel}
        onTogglePanel={togglePanel}
        unreadChat={chat.unread}
        handRaised={self.id in hands}
        onToggleHand={() => void changeHand({ raised: !(self.id in hands) })}
        onReaction={reactionsAllowed ? (code) => void sendReaction(code) : null}
      />
    </div>
  );
}
