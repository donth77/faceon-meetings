"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";

import { useElementSize } from "@/hooks/use-element-size";

import { useRoomMedia, type RoomParticipant } from "../media";
import { fitGrid } from "./grid";
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

/**
 * The video area. Auto shows a shared screen large, a one-on-one call as the other
 * person with you floating in the corner, and anything bigger as a gallery.
 */
export function Stage({ layout }: { layout: LayoutChoice }) {
  const media = useRoomMedia();
  const people = orderParticipants(media.participants);
  const presenter = people.find((p) => p.screen);
  const speakerKey = useSteadyValue(
    media.dominantSpeakerKey,
    SPEAKER_SWITCH_MS,
  );

  if (presenter && layout !== "gallery") {
    return (
      <FocusLayout
        main={{ participant: presenter, kind: "screen" }}
        strip={people}
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
        main={{ participant: speaker, kind: "video" }}
        strip={people.filter((p) => p !== speaker)}
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
          <Tile participant={tile.participant} kind={tile.kind} />
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

function OneOnOne({
  other,
  self,
}: {
  other: RoomParticipant;
  self: RoomParticipant | undefined;
}) {
  return (
    <div className="relative size-full">
      <Fitted>
        <Tile participant={other} />
      </Fitted>
      {self ? (
        <div className="absolute right-3 bottom-3 aspect-video w-32 overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10 sm:w-56">
          <Tile participant={self} />
        </div>
      ) : null}
    </div>
  );
}

/** One tile large (a shared screen or the speaker), everyone else in a strip beside it. */
function FocusLayout({
  main,
  strip,
}: {
  main: StageTile;
  strip: RoomParticipant[];
}) {
  const t = useTranslations("Meeting");
  return (
    <div className="flex size-full flex-col gap-2.5 lg:flex-row">
      <div className="min-h-0 min-w-0 flex-1">
        <Fitted>
          <Tile participant={main.participant} kind={main.kind} />
        </Fitted>
      </div>
      {strip.length > 0 ? (
        <ul
          aria-label={t("stageLabel")}
          className="flex shrink-0 gap-2.5 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto"
        >
          {strip.map((participant) => (
            <li
              key={participant.key}
              className="aspect-video h-24 shrink-0 lg:h-auto lg:w-full"
            >
              <Tile participant={participant} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
