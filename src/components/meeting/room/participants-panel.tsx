"use client";

import { Hand, Link2, Mic, MicOff, Search, VideoOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { Button } from "react-aria-components";

import type { AdmittedMeetingInfo, LobbyEntry } from "@/lib/meetings/api";

import { useInvitation } from "../invitation";
import { useRoomMedia, type RoomParticipant } from "../media";
import { ParticipantMenu } from "./participant-menu";
import { moderates } from "./roles";
import { useRoomControls } from "./room-controls";
import { SidePanel } from "./side-panel";
import { orderParticipants } from "./stage";

/** Guests' media identities start with "g_" (signed-in people have "u_"). */
const isGuest = (participant: RoomParticipant) =>
  participant.userId.startsWith("g_");

const FOOTER_BUTTON =
  "focus-visible:ring-ring flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] bg-white/10 text-sm font-semibold outline-none hover:bg-white/15 focus-visible:ring-2";

function ParticipantRow({
  participant,
  handNumber,
  onLowerHand,
}: {
  participant: RoomParticipant;
  /** Their place in the queue of raised hands, if their hand is up. */
  handNumber: number | null;
  /** Hosts can lower someone's hand. */
  onLowerHand: (() => void) | null;
}) {
  const t = useTranslations("Meeting.people");
  const th = useTranslations("Meeting.hand");
  const { roleOf } = useRoomControls();
  const role = roleOf(participant.userId);
  const tags = [
    participant.isLocal ? t("you") : null,
    role === "host" ? t("host") : role === "cohost" ? t("cohost") : null,
    isGuest(participant) ? t("guest") : null,
  ].filter(Boolean);

  return (
    <li className="group/row flex items-center gap-2.5 py-1.5 pr-3 pl-5 hover:bg-white/[0.04]">
      {participant.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={participant.image}
          alt=""
          className="size-8 shrink-0 rounded-full"
        />
      ) : (
        <span className="size-8 shrink-0 rounded-full bg-white/10" />
      )}
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5 text-sm">
        <span className="truncate">{participant.name}</span>
        {tags.length > 0 ? (
          <span className="text-muted-foreground shrink-0 text-xs">
            {tags.join(", ")}
          </span>
        ) : null}
      </span>
      <span className="text-muted-foreground flex items-center gap-2">
        {handNumber !== null ? (
          <span className="flex items-center gap-0.5 text-[#f2b200]">
            <Hand className="size-[18px]" aria-label={th("raised")} />
            <span className="text-xs font-bold">{handNumber}</span>
          </span>
        ) : null}
        {handNumber !== null && onLowerHand ? (
          <Button
            onPress={onLowerHand}
            className="text-foreground focus-visible:ring-ring rounded-md px-1.5 py-0.5 text-xs font-semibold outline-none hover:bg-white/10 focus-visible:ring-2"
          >
            {th("lower")}
          </Button>
        ) : null}
        {participant.video ? null : (
          <VideoOff className="size-[18px]" aria-label={t("videoOff")} />
        )}
        {participant.audio ? (
          <Mic className="size-[18px]" aria-label={t("micOn")} />
        ) : (
          <MicOff
            className="size-[18px] text-[#ff7a7d]"
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
      {entry.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.image}
          alt=""
          className="size-8 shrink-0 rounded-full"
        />
      ) : (
        <span className="size-8 shrink-0 rounded-full bg-white/10" />
      )}
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5 text-sm">
        <span className="truncate">{entry.name}</span>
        {entry.guest ? (
          <span className="text-muted-foreground shrink-0 text-xs">
            {t("guest")}
          </span>
        ) : null}
      </span>
      <Button
        onPress={onDeny}
        aria-label={tl("denyName", { name: entry.name })}
        className="focus-visible:ring-ring rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none hover:bg-white/10 focus-visible:ring-2"
      >
        {tl("deny")}
      </Button>
      <Button
        onPress={onAdmit}
        aria-label={tl("admitName", { name: entry.name })}
        className="bg-primary text-primary-foreground focus-visible:ring-ring rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none hover:opacity-90 focus-visible:ring-2"
      >
        {tl("admit")}
      </Button>
    </li>
  );
}

/**
 * Participants: the waiting room (for hosts), then everyone in the meeting, searchable,
 * with raised hands on top in the order they went up. Hosts get Mute all and each
 * person's ⋯ menu of host actions.
 */
export function ParticipantsPanel({
  meeting,
  waiting,
  onDecide,
  hands,
  onLowerHand,
  onLowerAll,
  onMuteAll,
  onClose,
}: {
  meeting: AdmittedMeetingInfo;
  /** The waiting room; hosts and co-hosts only. */
  waiting: LobbyEntry[];
  onDecide: (
    action:
      { action: "admit" | "deny"; ids: string[] } | { action: "admitAll" },
  ) => void;
  hands: Record<string, string>;
  onLowerHand: (userId: string) => void;
  onLowerAll: () => void;
  onMuteAll: () => void;
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

  const queue = Object.entries(hands)
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([userId]) => userId);
  const handNumber = (p: RoomParticipant) => {
    const index = queue.indexOf(p.userId);
    return index === -1 ? null : index + 1;
  };
  const everyone = orderParticipants(media.participants);
  const q = query.trim().toLocaleLowerCase();
  const shown = q
    ? everyone.filter((p) => p.name.toLocaleLowerCase().includes(q))
    : everyone;
  const waitingShown = q
    ? waiting.filter((w) => w.name.toLocaleLowerCase().includes(q))
    : waiting;
  const raised = shown
    .filter((p) => handNumber(p) !== null)
    .sort((a, b) => (handNumber(a) ?? 0) - (handNumber(b) ?? 0));
  const rest = shown.filter((p) => handNumber(p) === null);

  const row = (participant: RoomParticipant) => (
    <ParticipantRow
      key={participant.key}
      participant={participant}
      handNumber={handNumber(participant)}
      onLowerHand={isHost ? () => onLowerHand(participant.userId) : null}
    />
  );

  return (
    <SidePanel
      title={t("title", { count: everyone.length })}
      closeLabel={t("close")}
      onClose={onClose}
      footer={
        <>
          {isHost ? (
            <Button onPress={onMuteAll} className={FOOTER_BUTTON}>
              <MicOff className="size-[18px]" aria-hidden="true" />
              {t("muteAll")}
            </Button>
          ) : null}
          <Button
            onPress={() => void copyInvitation()}
            className={FOOTER_BUTTON}
          >
            <Link2 className="size-[18px]" aria-hidden="true" />
            {t("invite")}
          </Button>
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
          className="bg-background focus-visible:ring-ring h-10 w-full rounded-[10px] border pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {waitingShown.length > 0 ? (
          <section className="pb-3">
            <SectionHeading
              action={
                <Button
                  onPress={() => onDecide({ action: "admitAll" })}
                  className="text-primary focus-visible:ring-ring rounded-md px-1.5 py-0.5 text-xs font-semibold outline-none hover:bg-white/10 focus-visible:ring-2"
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
                    onPress={onLowerAll}
                    className="text-primary focus-visible:ring-ring rounded-md px-1.5 py-0.5 text-xs font-semibold outline-none hover:bg-white/10 focus-visible:ring-2"
                  >
                    {th("lowerAll")}
                  </Button>
                ) : undefined
              }
            >
              {t("raisedHands", { count: raised.length })}
            </SectionHeading>
            <ul>{raised.map(row)}</ul>
          </section>
        ) : null}
        {rest.length > 0 || raised.length === 0 ? (
          <section>
            <SectionHeading>{t("inMeeting")}</SectionHeading>
            {rest.length > 0 ? (
              <ul>{rest.map(row)}</ul>
            ) : (
              <p className="text-muted-foreground px-5 py-3 text-sm">
                {t("noMatch")}
              </p>
            )}
          </section>
        ) : null}
      </div>
    </SidePanel>
  );
}
