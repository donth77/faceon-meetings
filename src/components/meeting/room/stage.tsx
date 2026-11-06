"use client";

import { cn } from "cn";
import { Eye, EyeOff, MonitorUp, SquareDashed } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "react-aria-components";

import { useElementSize } from "@/hooks/use-element-size";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  TrackView,
  useDominantSpeakerKey,
  useRoomMedia,
  type RoomParticipant,
} from "../media";
import { useRoomTransition } from "./motion";
import { useRoomControls } from "./room-controls";
import { useChangeArea } from "./share-area";
import {
  ANY_SHAPE,
  croppable,
  exactly,
  fitBox,
  fitFocus,
  fitGrid,
  floatingShape,
  WIDESCREEN,
  type AspectRange,
} from "./stage-layout";
import { Tile, TileShapes } from "./tile";

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

/** Each picture's shape (width over height) as its tile last saw it, by tile key. */
type Shapes = ReadonlyMap<string, number>;

/**
 * The shapes a large tile may take: a shared screen exactly its own (it's never cropped),
 * a camera its picture's within the crop limit, and an avatar any (it fills the space).
 */
function shapesFor(tile: StageTile, shapes: Shapes): AspectRange {
  const aspect = shapes.get(tileKey(tile)) ?? WIDESCREEN;
  if (tile.kind === "screen") return exactly(aspect);
  return tile.participant.video ? croppable(aspect) : ANY_SHAPE;
}

/**
 * What decides where the strip goes: a camera's shape even while it's off, so the strip
 * doesn't move each time a camera goes on or off.
 */
function placementFor(tile: StageTile, shapes: Shapes): AspectRange {
  const aspect = shapes.get(tileKey(tile)) ?? WIDESCREEN;
  return tile.kind === "screen" ? exactly(aspect) : croppable(aspect);
}

/**
 * The video area. Someone you pinned comes first, then a shared screen, then whoever a
 * host spotlighted. Otherwise Auto shows a one-on-one call as the other person with
 * you floating in the corner, and anything bigger as a gallery; Speaker puts whoever's
 * talking large, and Spotlight shows only them (or the screen). Hide self view and Hide
 * tiles without video leave tiles out, but never the one shown large.
 */
export function Stage({ view }: { view: StageView }) {
  // Kept across layouts, so a tile shown large takes its picture's shape at once.
  const [shapes, setShapes] = useState<Shapes>(() => new Map());
  function learnShape(key: string, kind: StageTile["kind"], ratio: number) {
    setShapes((current) => {
      const id = `${key}:${kind}`;
      return current.get(id) === ratio
        ? current
        : new Map(current).set(id, ratio);
    });
  }
  return (
    <TileShapes value={learnShape}>
      <StageLayout view={view} shapes={shapes} />
    </TileShapes>
  );
}

/** Which layout shows and who goes where, as described on Stage. */
function StageLayout({ view, shapes }: { view: StageView; shapes: Shapes }) {
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
  const focus = (main: StageTile, strip: StageTile[]) => {
    if (view.layout === "spotlight") {
      return (
        <StageFade kind="spotlight">
          <Fitted range={shapesFor(main, shapes)}>
            <MainTile tile={main} />
          </Fitted>
        </StageFade>
      );
    }
    // Only you left for the strip: they get the stage and you float in the corner, as
    // in a one-on-one (Meet and Zoom do the same).
    const [only] = strip;
    if (
      strip.length === 1 &&
      main.kind === "video" &&
      only?.kind === "video" &&
      only.participant.isLocal
    ) {
      return (
        <StageFade kind="oneOnOne">
          <OneOnOne
            other={main.participant}
            self={only.participant}
            shapes={shapes}
          />
        </StageFade>
      );
    }
    return (
      <StageFade kind="focus">
        <FocusLayout
          main={main}
          strip={strip}
          range={shapesFor(main, shapes)}
          placeBy={placementFor(main, shapes)}
        />
      </StageFade>
    );
  };

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
        <OneOnOne
          other={speaker}
          self={view.hideSelf ? undefined : self}
          shapes={shapes}
        />
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
  // Same-sized tiles, cropping a widescreen camera by no more than the limit.
  const fit = fitGrid(
    tiles.length,
    size.width,
    size.height,
    GAP,
    croppable(WIDESCREEN),
  );
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

/** One tile as large as fits, in a shape from `range`, centered. */
function Fitted({
  range,
  children,
}: {
  range: AspectRange;
  children: ReactNode;
}) {
  const [size, ref] = useElementSize<HTMLDivElement>();
  const box = fitBox(size.width, size.height, range);
  return (
    <div ref={ref} className="flex size-full items-center justify-center">
      <div style={box}>{children}</div>
    </div>
  );
}

/** The other person large (filling a phone screen, as in Meet), you in the corner. */
function OneOnOne({
  other,
  self,
  shapes,
}: {
  other: RoomParticipant;
  self: RoomParticipant | undefined;
  shapes: Shapes;
}) {
  const fill = useIsMobile();
  return (
    // Filling a phone, the tile keeps its name and menu clear of the room's controls
    // while they show (meeting-shell.tsx); your floating tile doesn't need to.
    <div
      className={cn(
        "relative size-full",
        fill &&
          "[--tile-inset-bottom:var(--room-controls-bottom,0px)] [--tile-inset-top:var(--room-controls-top,0px)]",
      )}
    >
      {fill ? (
        <Tile participant={other} cover />
      ) : (
        <Fitted range={shapesFor(videoOf(other), shapes)}>
          <Tile participant={other} />
        </Fitted>
      )}
      {self ? <FloatingSelf participant={self} shapes={shapes} /> : null}
    </div>
  );
}

/**
 * You, floating in the corner: your camera's shape (a phone held upright is tall), as
 * much area as the usual 16:9 tile, or 16:9 with your camera off.
 */
function FloatingSelf({
  participant,
  shapes,
}: {
  participant: RoomParticipant;
  shapes: Shapes;
}) {
  const camera = shapes.get(tileKey(videoOf(participant))) ?? null;
  const shape = floatingShape(participant.video ? camera : null);
  return (
    // On a phone it clears the controls while they show (meeting-shell.tsx).
    <div
      style={
        {
          aspectRatio: shape.aspect,
          "--float-scale": shape.widthScale,
        } as CSSProperties
      }
      className="absolute right-3 bottom-[calc(0.75rem+var(--room-controls-bottom,0px))] w-[calc(8rem*var(--float-scale))] overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10 transition-[bottom] duration-200 ease-out [--tile-inset-bottom:0px] [--tile-inset-top:0px] motion-reduce:transition-none sm:w-[calc(14rem*var(--float-scale))]"
    >
      <Tile participant={participant} />
    </div>
  );
}

/**
 * Your own shared screen as everyone else sees it, with Stop sharing. Sharing the whole
 * screen shows the preview inside itself, so you can hide it; only you stop seeing it.
 * Sharing part of it, Change area moves the part without stopping.
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
  const changeArea = useChangeArea();
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
          {changeArea ? (
            <Button
              onPress={changeArea}
              className={cn(pill, "bg-white/15 text-white hover:bg-white/25")}
            >
              <SquareDashed className="size-4" aria-hidden="true" />
              {t("share.area.change")}
            </Button>
          ) : null}
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

/**
 * One tile large (a shared screen or the speaker), everyone else in a strip: beside it
 * on a wide stage, in a row under it on a tall one, whichever leaves the large tile
 * bigger (stage-layout.ts). The strip's tiles sit in the middle of it and scroll when
 * there are more than fit.
 */
function FocusLayout({
  main,
  strip,
  range,
  placeBy,
}: {
  main: StageTile;
  strip: StageTile[];
  /** The shapes the large tile may take. */
  range: AspectRange;
  /** The shapes that decide where the strip goes. */
  placeBy: AspectRange;
}) {
  const t = useTranslations("Meeting");
  const [size, ref] = useElementSize<HTMLDivElement>();
  const fit = fitFocus({
    width: size.width,
    height: size.height,
    gap: GAP,
    stripCount: strip.length,
    main: range,
    placeBy,
  });
  const side = fit.strip === "side";
  return (
    <div
      ref={ref}
      className={cn("flex size-full gap-2.5", side ? "flex-row" : "flex-col")}
    >
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
        <div style={fit.main}>
          <MainTile tile={main} />
        </div>
      </div>
      {strip.length > 0 ? (
        <ul
          aria-label={t("stageLabel")}
          style={
            side
              ? { width: fit.stripTile.width }
              : { height: fit.stripTile.height }
          }
          className={cn(
            "flex shrink-0 gap-2.5",
            side
              ? "flex-col overflow-x-hidden overflow-y-auto"
              : "overflow-x-auto overflow-y-hidden",
          )}
        >
          {strip.map((tile) => (
            <li
              key={tileKey(tile)}
              // Auto margins center the tiles while they fit, and let the strip scroll
              // from its start when they don't.
              className={cn(
                "aspect-video shrink-0",
                side
                  ? "w-full first:mt-auto last:mb-auto"
                  : "h-full first:ms-auto last:me-auto",
              )}
            >
              <MainTile tile={tile} compact />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
