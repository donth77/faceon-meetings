"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { UNSAFE_PortalProvider } from "react-aria/PortalProvider";
import { toast } from "sonner";

import { useIsMobile } from "@/hooks/use-mobile";
import { effectsSupported } from "@/lib/effects/support";
import type {
  AdmittedMeetingInfo,
  ModerateRequest,
  SelfInfo,
  SessionInfo,
} from "@/lib/meetings/api";
import { usePreferences, withDefaults } from "@/lib/preferences";

import { meetingApi } from "../api-client";
import { playSound } from "../chime";
import { useRoomMedia, type RoomParticipant } from "../media";
import { useMeetingTitle } from "../meeting-title";
import { AloneCard } from "./alone-card";
import { AloneCheckDialog, useAloneCheck } from "./alone-check";
import { ChatPanel } from "./chat-panel";
import { ConnectionBanner } from "./connection-banner";
import { ControlBar, type PanelName } from "./control-bar";
import { EffectsPanel } from "./effects-panel";
import {
  MuteAllDialog,
  RemoveDialog,
  TakeoverDialog,
  UnmuteRequestDialog,
} from "./host-dialogs";
import { InCallSettings, type InCallSection } from "./in-call-settings";
import { useRoomTransition } from "./motion";
import { NotesChip, NotesPanel } from "./notes-panel";
import { ParticipantsPanel } from "./participants-panel";
import {
  PictureInPicture,
  useAutoPictureInPicture,
  usePictureInPicture,
} from "./picture-in-picture";
import { FloatingReactions } from "./reactions";
import { moderates, roleIn, roomRoleOf } from "./roles";
import { RoomBadgesProvider } from "./room-badges";
import { RoomControlsProvider, type RoomControls } from "./room-controls";
import { useRoomEffects } from "./room-effects";
import { Stage, type StageView } from "./stage";
import { TopBar } from "./top-bar";
import { useChat } from "./use-chat";
import { useHands } from "./use-hands";
import { useHostNotices } from "./use-host-notices";
import { useLobby } from "./use-lobby";
import { useMeetingNotes } from "./use-meeting-notes";
import { useMeetingShortcuts } from "./use-meeting-shortcuts";
import { usePanels } from "./use-panels";
import { useRoomReactions } from "./use-reactions";
import {
  useDeviceProblemToast,
  useMutedNudge,
  usePresenceSounds,
} from "./use-room-alerts";
import { useScreenShare } from "./use-screen-share";

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
  // Settings, read once for the whole room.
  const prefs = withDefaults(usePreferences());
  const [view, setView] = useState<StageView>({
    layout: "auto",
    hideSelf: false,
    hideNoVideo: false,
  });
  function changeView(next: StageView) {
    // Others still see you; say so, as Meet does.
    if (next.hideSelf && !view.hideSelf) toast(t("selfHidden"));
    setView(next);
  }
  const [settings, setSettings] = useState<InCallSection | null>(null);
  const phone = useIsMobile();
  const panelTransition = useRoomTransition();
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RoomParticipant | null>(null);
  const [mutingAll, setMutingAll] = useState(false);
  const [canUseEffects] = useState(effectsSupported);

  // Roles and policies come from the shared state our server publishes; until it
  // arrives, you have the role you were admitted with.
  const state = media.sessionState;
  const selfRole = state ? roleIn(state, self.id) : roomRoleOf(self.role);
  const isHost = moderates(selfRole);
  const roleOf = (userId: string) =>
    userId === self.id ? selfRole : roleIn(state, userId);
  const sentByHost = (userId: string) => moderates(roleOf(userId));
  const nameOf = (userId: string) =>
    media.participants.find((p) => p.userId === userId)?.name ?? "";

  const panels = usePanels({ phone, isHost });
  function openPanel(name: PanelName) {
    panels.openPanel(name);
    if (name === "chat") chat.markRead();
  }
  function togglePanel(name: PanelName) {
    if (panels.open.includes(name)) panels.closePanel(name);
    else openPanel(name);
  }

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
    isOpen: panels.open.includes("chat"),
    accepts: (senderId) => (state?.chat ?? true) || sentByHost(senderId),
    // A preview of each new message while the chat panel is closed, as in both apps.
    onPreview: (message) => {
      playSound("message");
      if (!prefs.popupChat) return;
      toast(message.senderName, {
        description: message.text,
        action: { label: t("chat.open"), onClick: () => openPanel("chat") },
      });
    },
  });
  const notes = useMeetingNotes({
    media,
    code: meeting.code,
    session,
    self,
    isHost,
  });
  const reactions = useRoomReactions({
    media,
    selfId: self.id,
    isHost,
    sentByHost,
    nameOf,
    showOthers: prefs.showOthersReactions,
    announcements: prefs.reactionAnnouncements,
  });
  const { hands, changeHand } = useHands({
    media,
    code: meeting.code,
    selfId: self.id,
    isHost,
    popupHands: prefs.popupHands,
    nameOf,
    onView: () => openPanel("people"),
  });
  const badges = useMemo(
    () => ({
      hands,
      reactions: new Map(
        reactions.shown.map((r) => [r.userId, r.code] as const),
      ),
    }),
    [hands, reactions.shown],
  );

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

  // A host's policy can take the mic away; say so instead of failing.
  function toggleMic() {
    if (!media.mic.enabled && !media.mic.allowed) {
      toast(t("hostActions.micLocked"));
      return;
    }
    void media.mic.toggle();
  }
  const share = useScreenShare({ media, isHost, moderate });

  useMeetingShortcuts({
    toggleMic,
    toggleCamera: () => void media.camera.toggle(),
    toggleScreenShare: share.toggle,
    mic: () => ({ on: media.mic.enabled, allowed: media.mic.allowed }),
  });
  const alone = media.participants.length === 1;
  const aloneCheck = useAloneCheck(alone, session.aloneTimeoutMinutes);
  useDeviceProblemToast("microphone", media.mic.problem, media.mic.toggle);
  useDeviceProblemToast("camera", media.camera.problem, media.camera.toggle);
  useMutedNudge(media.mic.speakingWhileMuted, toggleMic);
  const pip = usePictureInPicture(title);
  useAutoPictureInPicture(pip, prefs.autoPictureInPicture);
  usePresenceSounds(media.participants);
  useRoomEffects();

  // On a phone a panel is a sheet over the room: the room behind it is left alone by
  // the keyboard and screen readers until it closes (2.4.11). It's set on the header,
  // main and footer themselves: React Aria resets the room's top-level children as its
  // menus close.
  const sheetOpen = phone && panels.shown.length > 0;

  function renderPanel(name: PanelName) {
    const close = () => panels.closePanel(name);
    if (name === "effects") {
      return <EffectsPanel key="effects" onClose={close} />;
    }
    if (name === "notes") {
      return (
        <NotesPanel
          key="notes"
          code={meeting.code}
          sessionId={session.id}
          canSave={self.signedIn}
          title={title}
          notes={notes.notes}
          demo={session.demo}
          isNotetaker={notes.isNotetaker}
          lines={notes.transcript.lines}
          notTranscribed={notes.notTranscribed}
          onChange={notes.setNotesOn}
          onOpenSettings={() => setSettings("aiNotes")}
          onDiscard={notes.transcript.clear}
          onClose={close}
        />
      );
    }
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
        onClose={close}
      />
    ) : (
      <ChatPanel
        key="chat"
        title={title}
        messages={chat.messages}
        canSend={(state?.chat ?? true) || isHost}
        onSend={chat.send}
        onClose={close}
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
          {/* Not the room's direct children: React Aria resets those as menus close. */}
          <div className="contents">
            <TopBar
              inert={sheetOpen}
              title={title}
              meeting={meeting}
              session={session}
              endsAt={endsAt}
              view={view}
              onViewChange={changeView}
              notes={
                notes.notes ? (
                  <NotesChip
                    notes={notes.notes}
                    self={notes.transcription.state}
                    onOptOutChange={notes.transcription.setOptedOut}
                    onDownload={() => void notes.transcription.download()}
                    onOpenNotes={
                      notes.canRunNotes ? () => openPanel("notes") : undefined
                    }
                  />
                ) : null
              }
            />
          </div>
          <ConnectionBanner status={media.status} />
          <div className="flex min-h-0 flex-1 px-3">
            <main inert={sheetOpen} className="relative min-h-0 min-w-0 flex-1">
              <RoomBadgesProvider value={badges}>
                <Stage view={view} />
              </RoomBadgesProvider>
              <FloatingReactions
                reactions={reactions.shown}
                nameOf={nameOf}
                selfId={self.id}
                animate={prefs.reactionAnimation}
              />
              {/* Heard even while a dialog is open (React Aria leaves top layers be). */}
              <div
                role="status"
                data-react-aria-top-layer="true"
                className="sr-only"
              >
                {reactions.news}
              </div>
              <AnimatePresence>
                {alone ? <AloneCard key="alone" meeting={meeting} /> : null}
              </AnimatePresence>
            </main>
            {phone ? (
              <AnimatePresence>{panels.shown.map(renderPanel)}</AnimatePresence>
            ) : (
              <AnimatePresence initial={false}>
                {panels.shown.length > 0 ? (
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
                        {panels.shown.map(renderPanel)}
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
            presenterName={share.takeover}
            onConfirm={() => void share.takeOver()}
            onClose={share.cancelTakeover}
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
          <PictureInPicture
            pipWindow={pip.pipWindow}
            onToggleMic={toggleMic}
            handRaised={self.id in hands}
            onToggleHand={() =>
              void changeHand({ raised: !(self.id in hands) })
            }
          />
          <InCallSettings
            section={settings}
            onSectionChange={setSettings}
            onClose={() => setSettings(null)}
          />
          <div className="contents">
            <ControlBar
              inert={sheetOpen}
              title={title}
              isOwner={selfRole === "host"}
              onEndForAll={onEndForAll}
              panels={panels.open}
              onTogglePanel={togglePanel}
              onOpenSettings={(section) => setSettings(section ?? "audio")}
              onOpenPictureInPicture={
                pip.supported ? () => void pip.open() : undefined
              }
              onOpenNotes={
                notes.canRunNotes ? () => openPanel("notes") : undefined
              }
              onOpenEffects={
                canUseEffects ? () => openPanel("effects") : undefined
              }
              unreadChat={chat.unread}
              waitingCount={lobby.requests.length}
              onToggleMic={toggleMic}
              share={{
                onBlocked: share.blocked,
                onStart: share.start,
                onStop: share.stop,
              }}
              handRaised={self.id in hands}
              onToggleHand={() =>
                void changeHand({ raised: !(self.id in hands) })
              }
              onReaction={reactions.send}
            />
          </div>
        </RoomControlsProvider>
      </UNSAFE_PortalProvider>
    </div>
  );
}
