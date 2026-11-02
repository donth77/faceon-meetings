"use client";

import { Hand, Link2, Mic, MicOff, Search, VideoOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { Button } from "react-aria-components";

import type {
  AdmittedMeetingInfo,
  LobbyAction,
  LobbyEntry,
} from "@/lib/meetings/api";
import type { SharedSessionState } from "@/lib/meetings/events";
import type { SessionPolicy } from "@/lib/meetings/policy";

import { useInvitation } from "../invitation";
import { useRoomMedia, type RoomParticipant } from "../media";
import { MeetingSettingsMenu, type AutoNotesSetting } from "./meeting-settings";
import { ParticipantMenu } from "./participant-menu";
import { moderates } from "./roles";
import { useRoomControls } from "./room-controls";
import { SidePanel } from "./side-panel";
import { orderParticipants } from "./stage";

/** Guests' media identities start with "g_" (signed-in people have "u_"). */
const isGuest = (participant: RoomParticipant) =>
  participant.userId.startsWith("g_");

const FOOTER_BUTTON =
  "flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] bg-white/10 text-sm font-semibold outline-hidden hover:bg-white/15 focus-visible:focus-ring";
const TEXT_BUTTON =
  "rounded-md px-1.5 py-0.5 text-xs font-semibold outline-hidden hover:bg-white/10 focus-visible:focus-ring";

function Avatar({ image }: { image: string | null | undefined }) {
  return image ? (
    // Avatars are small SVGs or provider photos; next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="size-8 shrink-0 rounded-full" />
  ) : (
    <span className="size-8 shrink-0 rounded-full bg-white/10" />
  );
}

function SectionHeading({
  children,
  action,
}: {
  children: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pr-3 pb-1.5 pl-5">
      <h3 className="text-muted-foreground text-xs font-bold tracking-[0.06em] uppercase">
        {children}
      </h3>
      {action}
    </div>
  );
}

/**
 * Where focus goes when a button is about to take its own row (or section) away: the
 * same button on the next row, or the one before, else the panel's title (2.4.3).
 */
function keepFocusNear(button: Element) {
  const action = button.getAttribute("data-row-action");
  const row = button.closest("li");
  const neighbour = row?.nextElementSibling ?? row?.previousElementSibling;
  const next = action
    ? neighbour?.querySelector(`[data-row-action="${action}"]`)
    : null;
  const title = button.closest("aside")?.querySelector("h2");
  requestAnimationFrame(() => {
    const target = [next, title].find(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element.isConnected,
    );
    target?.focus();
  });
}

/** Someone in the meeting: tags, camera and mic state, and their ⋯ menu. */
function ParticipantRow({ participant }: { participant: RoomParticipant }) {
  const t = useTranslations("Meeting.people");
  const locale = useLocale();
  const { roleOf } = useRoomControls();
  const role = roleOf(participant.userId);
  const tags = [
    participant.isLocal ? t("you") : null,
    role === "host" ? t("host") : role === "cohost" ? t("cohost") : null,
    isGuest(participant) ? t("guest") : null,
  ].filter((tag): tag is string => tag !== null);

  return (
    <li className="group/row flex items-center gap-2.5 py-1.5 pr-3 pl-5 hover:bg-white/[0.04]">
      <Avatar image={participant.image} />
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5 text-sm">
        <span className="truncate">{participant.name}</span>
        {tags.length > 0 ? (
          <span className="text-muted-foreground shrink-0 text-xs">
            {new Intl.ListFormat(locale, {
              style: "short",
              type: "unit",
            }).format(tags)}
          </span>
        ) : null}
      </span>
      <span className="text-muted-foreground flex items-center gap-2">
        {participant.video ? null : (
          <VideoOff className="size-[18px]" aria-label={t("videoOff")} />
        )}
        {participant.audio ? (
          <Mic className="size-[18px]" aria-label={t("micOn")} />
        ) : (
          <MicOff
            className="text-destructive-text size-[18px]"
            aria-label={t("muted")}
          />
        )}
        <ParticipantMenu
          participant={participant}
          className="text-foreground opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:bg-white/10 aria-expanded:opacity-100 pointer-coarse:opacity-100"
        />
      </span>
    </li>
  );
}

/** A raised hand, numbered in the order hands went up; hosts can lower it. */
function RaisedHandRow({
  participant,
  order,
  onLower,
}: {
  participant: RoomParticipant;
  order: number;
  onLower: (() => void) | null;
}) {
  const t = useTranslations("Meeting.hand");
  return (
    <li className="flex items-center gap-2.5 py-1.5 pr-3 pl-5">
      {/* A plain span can't be named, so the number is shown and the words are read. */}
      <span
        aria-hidden="true"
        className="bg-hand text-hand-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
      >
        {order}
      </span>
      <span className="sr-only">{t("position", { order })}</span>
      <span className="min-w-0 flex-1 truncate text-sm">
        {participant.name}
      </span>
      <Hand className="text-hand size-[18px]" aria-hidden="true" />
      {onLower ? (
        <Button
          onPress={(event) => {
            keepFocusNear(event.target);
            onLower();
          }}
          data-row-action="lower"
          aria-label={t("lowerFor", { name: participant.name })}
          className={TEXT_BUTTON}
        >
          {t("lowerShort")}
        </Button>
      ) : null}
    </li>
  );
}

/** Someone in the waiting room, with Deny and Admit. */
function WaitingRow({
  entry,
  onAdmit,
  onDeny,
}: {
  entry: LobbyEntry;
  onAdmit: () => void;
  onDeny: () => void;
}) {
  const t = useTranslations("Meeting.people");
  const tl = useTranslations("Meeting.lobby");
  return (
    <li className="flex items-center gap-2.5 py-1.5 pr-3 pl-5">
      <Avatar image={entry.image} />
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5 text-sm">
        <span className="truncate">{entry.name}</span>
        {entry.guest ? (
          <span className="text-muted-foreground shrink-0 text-xs">
            {t("guest")}
          </span>
        ) : null}
      </span>
      <Button
        onPress={(event) => {
          keepFocusNear(event.target);
          onDeny();
        }}
        data-row-action="deny"
        aria-label={tl("denyName", { name: entry.name })}
        className="focus-visible:focus-ring rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-hidden hover:bg-white/10"
      >
        {tl("deny")}
      </Button>
      <Button
        onPress={(event) => {
          keepFocusNear(event.target);
          onAdmit();
        }}
        data-row-action="admit"
        aria-label={tl("admitName", { name: entry.name })}
        className="bg-primary text-primary-foreground focus-visible:focus-ring rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-hidden hover:opacity-90"
      >
        {tl("admit")}
      </Button>
    </li>
  );
}

/**
 * Participants: the waiting room (for hosts), raised hands in the order they went up,
 * then everyone else, searchable. Hosts get Mute all, each person's ⋯ menu and Meeting
 * settings.
 */
export function ParticipantsPanel({
  meeting,
  state,
  waiting,
  onDecide,
  onLowerHand,
  onLowerAll,
  onMuteAll,
  onPolicyChange,
  autoNotes,
  onEndForAll,
  onClose,
}: {
  meeting: AdmittedMeetingInfo;
  state: SharedSessionState | null;
  /** The waiting room; hosts and co-hosts only. */
  waiting: LobbyEntry[];
  onDecide: (action: LobbyAction) => void;
  onLowerHand: (userId: string) => void;
  onLowerAll: () => void;
  onMuteAll: () => void;
  onPolicyChange: (policy: Partial<SessionPolicy>) => void;
  /** The meeting's host: whether AI notes start automatically. */
  autoNotes?: AutoNotesSetting | undefined;
  onEndForAll: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("Meeting.people");
  const th = useTranslations("Meeting.hand");
  const tl = useTranslations("Meeting.lobby");
  const media = useRoomMedia();
  const { selfRole } = useRoomControls();
  const isHost = moderates(selfRole);
  const { copyInvitation } = useInvitation(meeting);
  const searchId = useId();
  const [query, setQuery] = useState("");

  const queue = Object.entries(state?.hands ?? {})
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([userId]) => userId);
  const everyone = orderParticipants(media.participants);
  const q = query.trim().toLocaleLowerCase();
  const matches = (name: string) => !q || name.toLocaleLowerCase().includes(q);
  const shown = everyone.filter((p) => matches(p.name));
  const waitingShown = waiting.filter((w) => matches(w.name));
  const raised = queue
    .map((userId) => shown.find((p) => p.userId === userId))
    .filter((p): p is RoomParticipant => p !== undefined);
  const rest = shown.filter((p) => !queue.includes(p.userId));

  return (
    <SidePanel
      title={t("title", { count: everyone.length })}
      closeLabel={t("close")}
      onClose={onClose}
      footer={
        <>
          <Button
            onPress={() => void copyInvitation()}
            className={FOOTER_BUTTON}
          >
            <Link2 className="size-[18px]" aria-hidden="true" />
            {t("invite")}
          </Button>
          {isHost ? (
            <>
              <Button onPress={onMuteAll} className={FOOTER_BUTTON}>
                <MicOff className="size-[18px]" aria-hidden="true" />
                {t("muteAll")}
              </Button>
              <MeetingSettingsMenu
                state={state}
                isOwner={selfRole === "host"}
                onChange={onPolicyChange}
                autoNotes={autoNotes}
                onEndForAll={onEndForAll}
              />
            </>
          ) : null}
        </>
      }
    >
      <div className="relative shrink-0 px-4 pb-3">
        <label htmlFor={searchId} className="sr-only">
          {t("search")}
        </label>
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-[calc(50%+6px)]"
          aria-hidden="true"
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search")}
          className="bg-background focus-visible:focus-ring h-10 w-full rounded-[10px] border pr-3 pl-9 text-sm outline-hidden"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {waitingShown.length > 0 ? (
          <section className="pb-3">
            <SectionHeading
              action={
                <Button
                  onPress={(event) => {
                    keepFocusNear(event.target);
                    onDecide({ action: "admitAll" });
                  }}
                  className={`text-primary ${TEXT_BUTTON}`}
                >
                  {tl("admitAll")}
                </Button>
              }
            >
              {tl("waiting", { count: waitingShown.length })}
            </SectionHeading>
            <ul>
              {waitingShown.map((entry) => (
                <WaitingRow
                  key={entry.id}
                  entry={entry}
                  onAdmit={() => onDecide({ action: "admit", ids: [entry.id] })}
                  onDeny={() => onDecide({ action: "deny", ids: [entry.id] })}
                />
              ))}
            </ul>
          </section>
        ) : null}
        {raised.length > 0 ? (
          <section className="pb-3">
            <SectionHeading
              action={
                isHost ? (
                  <Button
                    onPress={(event) => {
                      keepFocusNear(event.target);
                      onLowerAll();
                    }}
                    className={`text-primary ${TEXT_BUTTON}`}
                  >
                    {th("lowerAll")}
                  </Button>
                ) : undefined
              }
            >
              {t("raisedHands", { count: raised.length })}
            </SectionHeading>
            <ul>
              {raised.map((participant) => (
                <RaisedHandRow
                  key={participant.key}
                  participant={participant}
                  order={queue.indexOf(participant.userId) + 1}
                  onLower={
                    isHost ? () => onLowerHand(participant.userId) : null
                  }
                />
              ))}
            </ul>
          </section>
        ) : null}
        <section>
          <SectionHeading>
            {raised.length > 0 ? t("everyoneElse") : t("inMeeting")}
          </SectionHeading>
          {rest.length > 0 ? (
            <ul>
              {rest.map((participant) => (
                <ParticipantRow
                  key={participant.key}
                  participant={participant}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-5 py-3 text-sm">
              {shown.length === 0 ? t("noMatch") : t("allHandsUp")}
            </p>
          )}
          {/* Mounted all along, so a search that finds nobody is heard (4.1.3). */}
          <p role="status" className="sr-only">
            {q && shown.length === 0 ? t("noMatch") : ""}
          </p>
        </section>
      </div>
    </SidePanel>
  );
}
