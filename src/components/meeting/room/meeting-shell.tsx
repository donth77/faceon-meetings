"use client";

import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { UNSAFE_PortalProvider } from "react-aria/PortalProvider";
import { toast } from "sonner";

import { useIsMobile } from "@/hooks/use-mobile";
import type { DeviceProblem } from "@/lib/device/problems";
import type {
  AdmittedMeetingInfo,
  ModerateRequest,
  SelfInfo,
  SessionInfo,
} from "@/lib/meetings/api";
import { reactionName } from "@/lib/meetings/events";
import {
  loadPreferences,
  usePreferences,
  withDefaults,
} from "@/lib/preferences";

import { meetingApi } from "../api-client";
import { playSound } from "../chime";
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
import { InCallSettings, type InCallSection } from "./in-call-settings";
import { useRoomTransition } from "./motion";
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
  const transition = useRoomTransition();
  return (
    <div role="status" className="flex justify-center px-3">
      <AnimatePresence initial={false}>
        {status === "joined" ? null : (
          <motion.p
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={transition}
            className="flex items-center gap-2 overflow-hidden rounded-lg bg-amber-400/15 px-3 text-sm text-amber-100"
          >
            <span className="flex items-center gap-2 py-2">
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {t(status === "offline" ? "offline" : "reconnecting")}
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Past this many people, joins and leaves make no sound, as in Meet: it would never stop. */
const SOUNDS_UP_TO = 8;

/**
 * A sound as you join, then as others join and leave. The people already here when you
 * arrive (who show up over the first moments) don't each get a sound.
 */
function usePresenceSounds(participants: RoomParticipant[]) {
  const known = useRef<Set<string> | null>(null);
  const settledAt = useRef(0);
  useEffect(() => {
    playSound("youJoined");
    settledAt.current = performance.now() + 2500;
  }, []);
  useEffect(() => {
    const others = new Set(
      participants.filter((p) => !p.isLocal).map((p) => p.key),
    );
    const before = known.current;
    known.current = others;
    if (!before || performance.now() < settledAt.current) return;
    if (participants.length > SOUNDS_UP_TO) return;
    if ([...others].some((key) => !before.has(key))) playSound("someoneJoined");
    else if ([...before].some((key) => !others.has(key)))
      playSound("someoneLeft");
  }, [participants]);
}

/** "You're muted" when you seem to be talking with the mic off, at most once a minute. */
function useMutedNudge(speakingWhileMuted: boolean, onUnmute: () => void) {
  const t = useTranslations("Meeting");
  const lastAt = useRef(0);
  const unmute = useEffectEvent(onUnmute);
  useEffect(() => {
    if (!speakingWhileMuted || Date.now() - lastAt.current < 60_000) return;
    lastAt.current = Date.now();
    toast(t("mutedNudge"), {
      id: "muted-nudge",
      action: { label: t("unmute"), onClick: () => unmute() },
    });
  }, [speakingWhileMuted, t]);
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
  // Participants and Chat can both be open on desktop; a phone shows the latest one.
  const [panels, setPanels] = useState<PanelName[]>([]);
  const [settings, setSettings] = useState<InCallSection | null>(null);
  const phone = useIsMobile();
  const panelTransition = useRoomTransition();
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
    isOpen: panels.includes("chat"),
    accepts: (senderId) => (state?.chat ?? true) || sentByHost(senderId),
    // A preview of each new message while the chat panel is closed, as in both apps.
    onPreview: (message) => {
      playSound("message");
      if (!withDefaults(loadPreferences()).popupChat) return;
      toast(message.senderName, {
        description: message.text,
        action: { label: t("chat.open"), onClick: () => openPanel("chat") },
      });
    },
  });

  const nameOf = (userId: string) =>
    media.participants.find((p) => p.userId === userId)?.name ?? "";

  // Raised hands and reactions.
  const hands = useMemo(() => state?.hands ?? {}, [state]);
  const reactionsAllowed = (state?.reactions ?? true) || isHost;
  const reactions = useReactions(
    media.subscribeReactions,
    (userId) => (state?.reactions ?? true) || sentByHost(userId),
  );
  const sendReaction = useReactionSender(media.sendReaction);
  const { showOthersReactions, reactionAnimation, reactionAnnouncements } =
    withDefaults(usePreferences());
  // Settings → Reactions: others' can be hidden; yours always show.
  const shownReactions = useMemo(
    () =>
      showOthersReactions
        ? reactions
        : reactions.filter((reaction) => reaction.userId === self.id),
    [reactions, showOthersReactions, self.id],
  );
  const reactionNews = useReactionAnnouncement(
    shownReactions,
    self.id,
    reactionAnnouncements,
    {
      summary: (count) => t("reactionsSummary", { count }),
      each: (reaction) =>
        t("reactionFrom", {
          name: nameOf(reaction.userId),
          reaction: t(`reactions.names.${reactionName(reaction.code)}`),
        }),
    },
  );
  const lastSounded = useRef(-1);
  useEffect(() => {
    const newest = shownReactions.at(-1);
    if (!newest || newest.id <= lastSounded.current) return;
    lastSounded.current = newest.id;
    playSound("reaction");
  }, [shownReactions]);
  const badges = useMemo(
    () => ({
      hands,
      reactions: new Map(
        shownReactions.map((r) => [r.userId, r.code] as const),
      ),
    }),
    [hands, shownReactions],
  );

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
      playSound("handRaised");
      if (!withDefaults(loadPreferences()).popupHands) return;
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
    setPanels((open) =>
      open.includes(next) ? open : phone ? [next] : [...open, next],
    );
    if (next === "chat") chat.markRead();
  }

  function closePanel(name: PanelName) {
    setPanels((open) => open.filter((panel) => panel !== name));
  }

  function togglePanel(next: PanelName) {
    if (panels.includes(next)) closePanel(next);
    else openPanel(next);
  }

  // Desktop keeps Participants above Chat; a phone shows the one opened last.
  const shownPanels = phone
    ? panels.slice(-1)
    : (["people", "chat"] as const).filter((name) => panels.includes(name));
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
  useMutedNudge(media.mic.speakingWhileMuted, toggleMic);
  usePresenceSounds(media.participants);

  function renderPanel(name: PanelName) {
    return name === "people" ? (
      <ParticipantsPanel
        key="people"
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
        onClose={() => closePanel("people")}
      />
    ) : (
      <ChatPanel
        key="chat"
        title={title}
        messages={chat.messages}
        canSend={(state?.chat ?? true) || isHost}
        onSend={chat.send}
        onClose={() => closePanel("chat")}
      />
    );
  }

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
          <div className="flex min-h-0 flex-1 px-3">
            <main className="relative min-h-0 min-w-0 flex-1">
              <RoomBadgesProvider value={badges}>
                <Stage layout={layout} />
              </RoomBadgesProvider>
              <FloatingReactions
                reactions={shownReactions}
                nameOf={nameOf}
                selfId={self.id}
                animate={reactionAnimation}
              />
              <div role="status" className="sr-only">
                {reactionNews}
              </div>
              <AnimatePresence>
                {alone ? <AloneCard key="alone" meeting={meeting} /> : null}
              </AnimatePresence>
            </main>
            {phone ? (
              <AnimatePresence>{shownPanels.map(renderPanel)}</AnimatePresence>
            ) : (
              <AnimatePresence initial={false}>
                {shownPanels.length > 0 ? (
                  // The column slides in beside the stage; a second panel grows in
                  // below the first.
                  <motion.div
                    key="panels"
                    initial={{ width: 0, marginLeft: 0, opacity: 0 }}
                    animate={{ width: 360, marginLeft: 12, opacity: 1 }}
                    exit={{ width: 0, marginLeft: 0, opacity: 0 }}
                    transition={panelTransition}
                    className="flex min-h-0 shrink-0 overflow-hidden"
                  >
                    <div className="flex min-h-0 w-[360px] shrink-0 flex-col gap-3">
                      <AnimatePresence initial={false}>
                        {shownPanels.map(renderPanel)}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            )}
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
          <InCallSettings
            section={settings}
            onSectionChange={setSettings}
            onClose={() => setSettings(null)}
          />
          <ControlBar
            title={title}
            isOwner={selfRole === "host"}
            onEndForAll={onEndForAll}
            panels={panels}
            onTogglePanel={togglePanel}
            onOpenSettings={(section) => setSettings(section ?? "audio")}
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
