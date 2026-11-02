"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { UNSAFE_PortalProvider } from "react-aria/PortalProvider";
import { toast } from "sonner";

import type { DeviceProblem } from "@/lib/device/problems";
import type {
  AdmittedMeetingInfo,
  ModerateRequest,
  SelfInfo,
  SessionInfo,
} from "@/lib/meetings/api";
import { usePreferences, withDefaults } from "@/lib/preferences";

import { meetingApi } from "../api-client";
import {
  useRoomMedia,
  type RoomParticipant,
  type RoomStatus,
  type ShareOptions,
} from "../media";
import { useMeetingTitle } from "../meeting-title";
import { AloneCard } from "./alone-card";
import { AloneCheckDialog, useAloneCheck } from "./alone-check";
import { ChatPanel } from "./chat-panel";
import { ControlBar, type PanelName } from "./control-bar";
import {
  MuteAllDialog,
  RemoveDialog,
  TakeoverDialog,
  UnmuteRequestDialog,
} from "./host-dialogs";
import { ParticipantsPanel } from "./participants-panel";
import { FloatingReactions } from "./reactions";
import { moderates, roleIn, roomRoleOf } from "./roles";
import { RoomBadgesProvider } from "./room-badges";
import { RoomControlsProvider, type RoomControls } from "./room-controls";
import { Stage, type LayoutChoice } from "./stage";
import { TopBar } from "./top-bar";
import { useChat } from "./use-chat";
import { useHostNotices } from "./use-host-notices";
import { useLobby } from "./use-lobby";
import { useMeetingShortcuts } from "./use-meeting-shortcuts";
import {
  useReactionAnnouncement,
  useReactions,
  useReactionSender,
} from "./use-reactions";

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
  const shellRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<LayoutChoice>("auto");
  const [panel, setPanel] = useState<PanelName | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RoomParticipant | null>(null);
  const [mutingAll, setMutingAll] = useState(false);
  const [takeover, setTakeover] = useState<{
    presenter: RoomParticipant;
    options: ShareOptions;
  } | null>(null);

  // Roles and policies come from the shared state our server publishes; until it
  // arrives, you have the role you were admitted with.
  const state = media.sessionState;
  const selfRole = state ? roleIn(state, self.id) : roomRoleOf(self.role);
  const isHost = moderates(selfRole);
  const roleOf = (userId: string) =>
    userId === self.id ? selfRole : roleIn(state, userId);
  const sentByHost = (userId: string) => moderates(roleOf(userId));
  const notices = useHostNotices({ media, selfId: self.id, selfRole });
  const lobby = useLobby({
    code: meeting.code,
    isHost,
    media,
    onView: () => openPanel("people"),
  });

  const chat = useChat({
    media,
    self,
    isOpen: panel === "chat",
    accepts: (senderId) => (state?.chat ?? true) || sentByHost(senderId),
    // A preview of each new message while the chat panel is closed, as in both apps.
    onPreview: (message) =>
      toast(message.senderName, {
        description: message.text,
        action: { label: t("chat.open"), onClick: () => openPanel("chat") },
      }),
  });

  // Raised hands and reactions.
  const hands = useMemo(() => state?.hands ?? {}, [state]);
  const reactionsAllowed = (state?.reactions ?? true) || isHost;
  const reactions = useReactions(
    media.subscribeReactions,
    (userId) => (state?.reactions ?? true) || sentByHost(userId),
  );
  const sendReaction = useReactionSender(media.sendReaction);
  const { announceReactions } = withDefaults(usePreferences());
  const reactionNews = useReactionAnnouncement(
    reactions,
    self.id,
    announceReactions,
    (count) => t("reactionsSummary", { count }),
  );
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
      toast(t("hand.someoneRaised", { name: nameOf(userId) }), {
        action: { label: t("hand.view"), onClick: () => openPanel("people") },
      });
    }
  });
  useEffect(() => {
    const before = previousHands.current;
    previousHands.current = hands;
    for (const userId of Object.keys(hands)) {
      if (!(userId in before)) announceHand(userId);
    }
  }, [hands]);

  async function moderate(request: ModerateRequest): Promise<void> {
    try {
      await meetingApi.moderate(meeting.code, request);
      if (request.action === "askToUnmute") {
        toast(t("moderation.askedToUnmute", { name: nameOf(request.target) }));
      }
    } catch {
      toast.error(t("moderation.failed"));
    }
  }

  const controls: RoomControls = {
    selfId: self.id,
    selfRole,
    roleOf,
    pinnedKey,
    togglePin: (key) =>
      setPinnedKey((current) => (current === key ? null : key)),
    spotlight: state?.spotlight ?? null,
    moderate,
    confirmRemove: setRemoving,
  };

  // A host's policy can take the mic or screen sharing away; say so instead of failing.
  function toggleMic() {
    if (!media.mic.enabled && !media.mic.allowed) {
      toast(t("hostActions.micLocked"));
      return;
    }
    void media.mic.toggle();
  }

  // One person shares at a time. Hosts and co-hosts can take over; others wait.
  const presenter = media.participants.find((p) => p.screen && !p.isLocal);
  const shareBlocked = !media.screenShare.allowed
    ? () => void toast(t("hostActions.shareLocked"))
    : presenter && !isHost
      ? () => void toast(t("share.someoneSharing", { name: presenter.name }))
      : null;

  /** Shares the screen; false when it didn't start (say, the picker was cancelled). */
  async function share(options: ShareOptions): Promise<boolean> {
    try {
      await media.screenShare.start(options);
      return true;
    } catch (error) {
      const cancelled =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "AbortError");
      if (!cancelled) toast.error(t("share.failed"));
      return false;
    }
  }

  function startShare(options: ShareOptions) {
    if (shareBlocked) shareBlocked();
    else if (presenter) setTakeover({ presenter, options });
    else void share(options);
  }

  async function takeOver() {
    if (!takeover) return;
    setTakeover(null);
    // The picker first, while the click still counts; their share stops once yours starts.
    if (await share(takeover.options)) {
      await moderate({
        action: "mute",
        target: takeover.presenter.userId,
        kind: "screenshare",
      });
    }
  }

  function toggleScreenShare() {
    if (media.screenShare.enabled) void media.screenShare.stop();
    else startShare({ audio: true, motion: false });
  }

  function openPanel(next: PanelName) {
    setPanel(next);
    if (next === "chat") chat.markRead();
  }

  function togglePanel(next: PanelName) {
    if (panel === next) setPanel(null);
    else openPanel(next);
  }
  useMeetingShortcuts({
    toggleMic,
    toggleCamera: () => void media.camera.toggle(),
    toggleScreenShare,
    mic: () => ({ on: media.mic.enabled, allowed: media.mic.allowed }),
  });
  const alone = media.participants.length === 1;
  const aloneCheck = useAloneCheck(alone, session.aloneTimeoutMinutes);
  useDeviceProblemToast("microphone", media.mic.problem, media.mic.toggle);
  useDeviceProblemToast("camera", media.camera.problem, media.camera.toggle);

  return (
    <div
      ref={shellRef}
      data-fullscreen
      className="dark bg-background text-foreground flex h-dvh flex-col overflow-hidden"
    >
      {/* Menus and dialogs open inside the room, so they're dark like it. */}
      <UNSAFE_PortalProvider getContainer={() => shellRef.current}>
        <RoomControlsProvider value={controls}>
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
              <div role="status" className="sr-only">
                {reactionNews}
              </div>
              {alone ? <AloneCard meeting={meeting} /> : null}
            </main>
            {panel === "people" ? (
              <ParticipantsPanel
                meeting={meeting}
                state={state}
                waiting={lobby.requests}
                onDecide={(action) => void lobby.decide(action)}
                onLowerHand={(userId) =>
                  void changeHand({ raised: false, target: userId })
                }
                onLowerAll={() => void changeHand({ lowerAll: true })}
                onMuteAll={() => setMutingAll(true)}
                onPolicyChange={(policy) =>
                  void moderate({ action: "setPolicy", policy })
                }
                onEndForAll={onEndForAll}
                onClose={() => setPanel(null)}
              />
            ) : panel === "chat" ? (
              <ChatPanel
                title={title}
                messages={chat.messages}
                canSend={(state?.chat ?? true) || isHost}
                onSend={chat.send}
                onClose={() => setPanel(null)}
              />
            ) : null}
          </div>
          <RemoveDialog
            participant={removing}
            onRemove={(participant) =>
              void moderate({ action: "remove", target: participant.userId })
            }
            onClose={() => setRemoving(null)}
          />
          <MuteAllDialog
            isOpen={mutingAll}
            selfUnmute={state?.selfUnmute ?? true}
            onMuteAll={(selfUnmute) =>
              void moderate({ action: "muteAll", selfUnmute })
            }
            onClose={() => setMutingAll(false)}
          />
          <TakeoverDialog
            presenterName={takeover?.presenter.name ?? null}
            onConfirm={() => void takeOver()}
            onClose={() => setTakeover(null)}
          />
          <UnmuteRequestDialog
            isOpen={notices.unmuteAsked}
            onUnmute={toggleMic}
            onClose={notices.dismissUnmute}
          />
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
            isOwner={selfRole === "host"}
            onEndForAll={onEndForAll}
            panel={panel}
            onTogglePanel={togglePanel}
            unreadChat={chat.unread}
            waitingCount={lobby.requests.length}
            onToggleMic={toggleMic}
            share={{
              onBlocked: shareBlocked,
              onStart: startShare,
              onStop: () => void media.screenShare.stop(),
            }}
            handRaised={self.id in hands}
            onToggleHand={() =>
              void changeHand({ raised: !(self.id in hands) })
            }
            onReaction={
              reactionsAllowed ? (code) => void sendReaction(code) : null
            }
          />
        </RoomControlsProvider>
      </UNSAFE_PortalProvider>
    </div>
  );
}
