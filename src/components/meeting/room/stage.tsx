"use client";

import { cn } from "cn";
import { Eye, EyeOff, MonitorUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "react-aria-components";

import { useElementSize } from "@/hooks/use-element-size";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  TrackView,
  useDominantSpeakerKey,
  useRoomMedia,
  type RoomParticipant,
} from "../media";
import { fitGrid } from "./grid";
import { useRoomTransition } from "./motion";
import { useRoomControls } from "./room-controls";
import { Tile } from "./tile";

export type LayoutChoice = "auto" | "gallery" | "speaker" | "spotlight";

/** How you've chosen to see the meeting: a layout, and who to leave out. */
export type StageView = {
  layout: LayoutChoice;
  /** Your own tile, hidden from you (others still see you). */
  hideSelf: boolean;
  /** Tiles of people whose camera is off. */
  hideNoVideo: boolean;
};

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
 * you floating in the corner, and anything bigger as a gallery; Speaker puts whoever's
 * talking large, and Spotlight shows only them (or the screen). Hide self view and Hide
 * tiles without video leave tiles out, but never the one shown large.
 */
export function Stage({ view }: { view: StageView }) {
  const media = useRoomMedia();
  const { pinnedKey, spotlight } = useRoomControls();
  const everyone = orderParticipants(media.participants);
  const presenter = everyone.find((p) => p.screen);
  const screen: StageTile[] = presenter
    ? [{ participant: presenter, kind: "screen" }]
    : [];
  const speakerKey = useSteadyValue(useDominantSpeakerKey(), SPEAKER_SWITCH_MS);
  // Who the view leaves in the strip or the gallery.
  const people = everyone.filter(
    (p) => !(view.hideSelf && p.isLocal) && !(view.hideNoVideo && !p.video),
  );
  const stripWithout = (main: RoomParticipant, withScreen = true) => [
    ...(withScreen ? screen : []),
    ...people.filter((p) => p !== main).map(videoOf),
  ];
  const focus = (main: StageTile, strip: StageTile[]) =>
    view.layout === "spotlight" ? (
      <StageFade kind="spotlight">
        <Fitted>
          <MainTile tile={main} />
        </Fitted>
      </StageFade>
    ) : (
      <StageFade kind="focus">
        <FocusLayout main={main} strip={strip} />
      </StageFade>
    );

  const pinned = everyone.find((p) => p.key === pinnedKey);
  if (pinned) return focus(videoOf(pinned), stripWithout(pinned));
  if (presenter && view.layout !== "gallery") {
    return focus(
      { participant: presenter, kind: "screen" },
      people.map(videoOf),
    );
  }
  const spotlighted = everyone.find((p) => p.userId === spotlight);
  if (spotlighted)
    return focus(videoOf(spotlighted), stripWithout(spotlighted));

  const self = everyone.find((p) => p.isLocal);
  const others = everyone.filter((p) => !p.isLocal);
  const speaker = others.find((p) => p.key === speakerKey) ?? others[0] ?? self;

  if (view.layout === "auto" && others.length === 1 && speaker) {
    return (
      <StageFade kind="oneOnOne">
        <OneOnOne other={speaker} self={view.hideSelf ? undefined : self} />
      </StageFade>
    );
  }
  if ((view.layout === "speaker" || view.layout === "spotlight") && speaker) {
    return focus(videoOf(speaker), stripWithout(speaker, false));
  }

  const tiles: StageTile[] = people.map(videoOf);
  if (presenter) tiles.unshift({ participant: presenter, kind: "screen" });
  if (tiles.length === 0) {
    return (
      <StageFade kind="empty">
        <NobodyShown />
      </StageFade>
    );
  }
  return (
    <StageFade kind="gallery">
      <Gallery tiles={tiles} />
    </StageFade>
  );
}

/** When the view's choices leave nobody to show. */
function NobodyShown() {
  const t = useTranslations("Meeting");
  return (
    <div className="flex size-full items-center justify-center p-6">
      <p className="text-muted-foreground max-w-xs text-center text-sm">
        {t("nothingToShow")}
      </p>
    </div>
  );
}

/** A new layout (gallery, one-on-one, a focus) fades in rather than snapping. */
function StageFade({ kind, children }: { kind: string; children: ReactNode }) {
  const transition = useRoomTransition(0.2);
  return (
    <motion.div
      key={kind}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition}
      className="size-full"
    >
      {children}
    </motion.div>
  );
}

function Gallery({ tiles }: { tiles: StageTile[] }) {
  const t = useTranslations("Meeting");
  const [size, ref] = useElementSize<HTMLUListElement>();
  const fit = fitGrid(tiles.length, size.width, size.height, GAP);
  const transition = useRoomTransition(0.28);

  return (
    <ul
      ref={ref}
      aria-label={t("stageLabel")}
      className="relative flex size-full flex-wrap content-center items-center justify-center gap-2.5"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {tiles.map((tile) => (
          <motion.li
            key={tileKey(tile)}
            // Joins and leaves move tiles smoothly; a resize just follows.
            layout
            layoutDependency={tiles.length}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={transition}
            style={{ width: fit.tileWidth, height: fit.tileHeight }}
          >
            <MainTile tile={tile} />
          </motion.li>
        ))}
      </AnimatePresence>
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
 * Your own shared screen as everyone else sees it, with Stop sharing. Sharing the whole
 * screen shows the preview inside itself, so you can hide it; only you stop seeing it.
 */
function OwnScreen({
  participant,
  compact,
}: {
  participant: RoomParticipant;
  /** In the strip beside a larger tile: just the preview and a label. */
  compact: boolean;
}) {
  const t = useTranslations("Meeting");
  const { screenShare } = useRoomMedia();
  const [hidden, setHidden] = useState(false);
  const pill =
    "flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold outline-hidden focus-visible:focus-ring";
  return (
    <div className="bg-card relative size-full overflow-hidden rounded-xl">
      {hidden ? (
        <p className="text-muted-foreground absolute inset-0 flex items-center justify-center p-6 pb-20 text-center text-sm">
          {t("previewHidden")}
        </p>
      ) : (
        <TrackView
          participant={participant}
          kind="screen"
          className="absolute inset-0 size-full object-contain"
        />
      )}
      {compact ? (
        <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-lg bg-black/65 px-2 py-1 text-[13px] font-medium text-white">
          <MonitorUp className="size-3.5" aria-hidden="true" />
          {t("youAreSharing")}
        </span>
      ) : (
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pt-12 pb-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <MonitorUp className="text-primary size-5" aria-hidden="true" />
            {t("youAreSharing")}
          </span>
          <Button
            onPress={() => setHidden((current) => !current)}
            className={cn(pill, "bg-white/15 text-white hover:bg-white/25")}
          >
            {hidden ? (
              <Eye className="size-4" aria-hidden="true" />
            ) : (
              <EyeOff className="size-4" aria-hidden="true" />
            )}
            {hidden ? t("showPreview") : t("hidePreview")}
          </Button>
          <Button
            onPress={() => {
              void screenShare.stop();
              // This preview goes away; focus goes to the bar's Share screen.
              requestAnimationFrame(() =>
                document
                  .querySelector<HTMLElement>("[data-share-control] button")
                  ?.focus(),
              );
            }}
            className={cn(
              pill,
              "bg-destructive-fill hover:bg-destructive-fill/90 text-white",
            )}
          >
            {t("stopSharing")}
          </Button>
        </div>
      )}
    </div>
  );
}

function MainTile({
  tile,
  compact = false,
}: {
  tile: StageTile;
  compact?: boolean;
}) {
  if (tile.kind === "screen" && tile.participant.isLocal) {
    return <OwnScreen participant={tile.participant} compact={compact} />;
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
              <MainTile tile={tile} compact />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
