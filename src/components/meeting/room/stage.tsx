"use client";

import { MonitorUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "react-aria-components";

import { useElementSize } from "@/hooks/use-element-size";
import { useIsMobile } from "@/hooks/use-mobile";

import { useRoomMedia, type RoomParticipant } from "../media";
import { fitGrid } from "./grid";
import { useRoomControls } from "./room-controls";
import { Tile } from "./tile";

export type LayoutChoice = "auto" | "gallery" | "speaker";

type StageTile = { participant: RoomParticipant; kind: "video" | "screen" };

const GAP = 10;
/** How long someone must lead the conversation before the speaker view switches to them. */
const SPEAKER_SWITCH_MS = 1500;

/** You first, then everyone else in the order they joined, so tiles don't jump around. */
export function orderParticipants(list: RoomParticipant[]): RoomParticipant[] {
  return [...list].sort(
    (a, b) =>
      Number(b.isLocal) - Number(a.isLocal) ||
      a.joinedAt - b.joinedAt ||
      a.key.localeCompare(b.key),
  );
}

/** Follows `value`, but only once it has held steady for `delayMs`. */
function useSteadyValue<T>(value: T, delayMs: number): T {
  const [steady, setSteady] = useState(value);
  useEffect(() => {
    if (Object.is(value, steady)) return;
    const timer = setTimeout(() => setSteady(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, steady, delayMs]);
  return steady;
}

const tileKey = (tile: StageTile) => `${tile.participant.key}:${tile.kind}`;

const videoOf = (participant: RoomParticipant): StageTile => ({
  participant,
  kind: "video",
});

/**
 * The video area. Someone you pinned comes first, then a shared screen, then whoever a
 * host spotlighted. Otherwise Auto shows a one-on-one call as the other person with
 * you floating in the corner, and anything bigger as a gallery.
 */
export function Stage({ layout }: { layout: LayoutChoice }) {
  const media = useRoomMedia();
  const { pinnedKey, spotlight } = useRoomControls();
  const people = orderParticipants(media.participants);
  const presenter = people.find((p) => p.screen);
  const screen: StageTile[] = presenter
    ? [{ participant: presenter, kind: "screen" }]
    : [];
  const speakerKey = useSteadyValue(
    media.dominantSpeakerKey,
    SPEAKER_SWITCH_MS,
  );

  const pinned = people.find((p) => p.key === pinnedKey);
  if (pinned) {
    return (
      <FocusLayout
        main={videoOf(pinned)}
        strip={[...screen, ...people.filter((p) => p !== pinned).map(videoOf)]}
      />
    );
  }
  if (presenter && layout !== "gallery") {
    return (
      <FocusLayout
        main={{ participant: presenter, kind: "screen" }}
        strip={people.map(videoOf)}
      />
    );
  }
  const spotlighted = people.find((p) => p.userId === spotlight);
  if (spotlighted) {
    return (
      <FocusLayout
        main={videoOf(spotlighted)}
        strip={[
          ...screen,
          ...people.filter((p) => p !== spotlighted).map(videoOf),
        ]}
      />
    );
  }

  const self = people.find((p) => p.isLocal);
  const others = people.filter((p) => !p.isLocal);
  const speaker = others.find((p) => p.key === speakerKey) ?? others[0] ?? self;

  if (layout === "auto" && others.length === 1 && speaker) {
    return <OneOnOne other={speaker} self={self} />;
  }
  if (layout === "speaker" && speaker) {
    return (
      <FocusLayout
        main={videoOf(speaker)}
        strip={people.filter((p) => p !== speaker).map(videoOf)}
      />
    );
  }

  const tiles: StageTile[] = people.map((participant) => ({
    participant,
    kind: "video",
  }));
  if (presenter) tiles.unshift({ participant: presenter, kind: "screen" });
  return <Gallery tiles={tiles} />;
}

function Gallery({ tiles }: { tiles: StageTile[] }) {
  const t = useTranslations("Meeting");
  const [size, ref] = useElementSize<HTMLUListElement>();
  const fit = fitGrid(tiles.length, size.width, size.height, GAP);

  return (
    <ul
      ref={ref}
      aria-label={t("stageLabel")}
      className="flex size-full flex-wrap content-center items-center justify-center gap-2.5"
    >
      {tiles.map((tile) => (
        <li
          key={tileKey(tile)}
          style={{ width: fit.tileWidth, height: fit.tileHeight }}
        >
          <MainTile tile={tile} />
        </li>
      ))}
    </ul>
  );
}

/** One 16:9 tile, as large as fits and centered. */
function Fitted({ children }: { children: ReactNode }) {
  const [size, ref] = useElementSize<HTMLDivElement>();
  const fit = fitGrid(1, size.width, size.height, 0);
  return (
    <div ref={ref} className="flex size-full items-center justify-center">
      <div style={{ width: fit.tileWidth, height: fit.tileHeight }}>
        {children}
      </div>
    </div>
  );
}

/** The other person large (filling a phone screen, as in Meet), you in the corner. */
function OneOnOne({
  other,
  self,
}: {
  other: RoomParticipant;
  self: RoomParticipant | undefined;
}) {
  const fill = useIsMobile();
  return (
    <div className="relative size-full">
      {fill ? (
        <Tile participant={other} />
      ) : (
        <Fitted>
          <Tile participant={other} />
        </Fitted>
      )}
      {self ? (
        <div className="absolute right-3 bottom-3 aspect-video w-32 overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10 sm:w-56">
          <Tile participant={self} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * In place of your own shared screen: showing it back to you would make a hall of
 * mirrors. Everyone else sees the screen itself.
 */
function SharingNotice() {
  const t = useTranslations("Meeting");
  const { screenShare } = useRoomMedia();
  return (
    <div className="bg-card flex size-full flex-col items-center justify-center gap-4 rounded-xl p-6 text-center">
      <MonitorUp className="text-primary size-10" aria-hidden="true" />
      <p className="text-lg font-semibold">{t("youAreSharing")}</p>
      <Button
        onPress={() => void screenShare.toggle()}
        className="bg-destructive hover:bg-destructive/90 focus-visible:ring-ring h-10 rounded-full px-5 text-sm font-semibold text-white outline-none focus-visible:ring-2"
      >
        {t("stopSharing")}
      </Button>
    </div>
  );
}

function MainTile({ tile }: { tile: StageTile }) {
  if (tile.kind === "screen" && tile.participant.isLocal) {
    return <SharingNotice />;
  }
  return <Tile participant={tile.participant} kind={tile.kind} />;
}

/** One tile large (a shared screen or the speaker), everyone else in a strip beside it. */
function FocusLayout({ main, strip }: { main: StageTile; strip: StageTile[] }) {
  const t = useTranslations("Meeting");
  return (
    <div className="flex size-full flex-col gap-2.5 lg:flex-row">
      <div className="min-h-0 min-w-0 flex-1">
        <Fitted>
          <MainTile tile={main} />
        </Fitted>
      </div>
      {strip.length > 0 ? (
        <ul
          aria-label={t("stageLabel")}
          className="flex shrink-0 gap-2.5 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto"
        >
          {strip.map((tile) => (
            <li
              key={tileKey(tile)}
              className="aspect-video h-24 shrink-0 lg:h-auto lg:w-full"
            >
              <MainTile tile={tile} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
