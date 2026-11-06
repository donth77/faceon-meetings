"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import {
  createContext,
  use,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  areaAfterKey,
  areaBetween,
  cropRect,
  moveArea,
  resizeArea,
  type Area,
  type Edges,
  type Point,
} from "@/lib/screen-share/area";

import type { AreaChoice } from "./use-screen-share";

/** Moves the area of the part of a screen being shared; null unless one is. */
const ChangeAreaContext = createContext<(() => void) | null>(null);

export function ChangeAreaProvider({
  value,
  children,
}: {
  value: (() => void) | null;
  children: ReactNode;
}) {
  return <ChangeAreaContext value={value}>{children}</ChangeAreaContext>;
}

export const useChangeArea = () => use(ChangeAreaContext);

/** The box's resize handles: its corners and the middle of each edge. */
const HANDLES: Array<{ edges: Edges; className: string }> = [
  {
    edges: { top: true, left: true },
    className: "-top-1.5 -left-1.5 cursor-nwse-resize",
  },
  {
    edges: { top: true },
    className: "-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize",
  },
  {
    edges: { top: true, right: true },
    className: "-top-1.5 -right-1.5 cursor-nesw-resize",
  },
  {
    edges: { right: true },
    className: "top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize",
  },
  {
    edges: { bottom: true, right: true },
    className: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
  },
  {
    edges: { bottom: true },
    className: "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize",
  },
  {
    edges: { bottom: true, left: true },
    className: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
  },
  {
    edges: { left: true },
    className: "top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize",
  },
];

/** A box drawn by dragging starts once the pointer has moved this far (a share of the screen). */
const DRAW_AFTER = 0.01;

type Drag =
  | { kind: "move"; from: Point; start: Area }
  | { kind: "resize"; edges: Edges; from: Point; start: Area }
  | { kind: "draw"; from: Point };

/**
 * Choosing the part of a screen to share: the screen, live, with a box over it to drag,
 * resize or draw again, and its size in pixels. Nothing is sent while it's open, and
 * moving the area of a share under way changes it only once it's done. Keyboard: the
 * arrow keys move the box, Shift with them resizes it, and Enter confirms it.
 */
export function ShareAreaDialog({
  choice,
  onChoose,
  onCancel,
}: {
  /** The screen and the box to start from; null keeps the dialog closed. */
  choice: AreaChoice | null;
  onChoose: (area: Area) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      isOpen={choice !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      showCloseButton={false}
      className="sm:max-w-3xl"
    >
      {choice ? (
        <AreaPicker
          key={`${choice.screen.id}:${choice.changing}`}
          choice={choice}
          onChoose={onChoose}
          onCancel={onCancel}
        />
      ) : null}
    </Dialog>
  );
}

function AreaPicker({
  choice,
  onChoose,
  onCancel,
}: {
  choice: AreaChoice;
  onChoose: (area: Area) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Meeting.share.area");
  const [area, setArea] = useState(choice.area);
  // What a screen reader hears after a key changes the box: its size, not every step of a drag.
  const [announced, setAnnounced] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const drag = useRef<Drag | null>(null);
  const keysId = useId();

  const settings = choice.screen.getSettings();
  const width = settings.width || 1920;
  const height = settings.height || 1080;
  const pixels = cropRect(area, width, height);
  const size = t("size", {
    width: String(pixels.width),
    height: String(pixels.height),
  });

  // Keyboard users start on the box, ready to move it.
  useEffect(() => box.current?.focus(), []);

  // The screen as it is now, so the box goes over what's there; only shown here.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = new MediaStream([choice.screen]);
    return () => {
      element.srcObject = null;
    };
  }, [choice.screen]);

  const pointAt = (event: PointerEvent): Point => {
    const box = stage.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return { x: 0, y: 0 };
    return {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
  };

  function startDrag(event: PointerEvent, next: Drag) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stage.current?.setPointerCapture(event.pointerId);
    drag.current = next;
  }

  function onPointerMove(event: PointerEvent) {
    const current = drag.current;
    if (!current) return;
    const at = pointAt(event);
    const dx = at.x - current.from.x;
    const dy = at.y - current.from.y;
    if (current.kind === "move") setArea(moveArea(current.start, dx, dy));
    else if (current.kind === "resize") {
      setArea(resizeArea(current.start, current.edges, dx, dy));
    } else if (Math.hypot(dx, dy) >= DRAW_AFTER) {
      setArea(areaBetween(current.from, at));
    }
  }

  const endDrag = () => {
    drag.current = null;
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          {t("title")}
        </DialogTitle>
        <DialogDescription>{t("body")}</DialogDescription>
      </DialogHeader>
      <div
        ref={stage}
        className="relative mx-auto touch-none overflow-hidden rounded-lg bg-black select-none"
        style={{
          aspectRatio: `${width} / ${height}`,
          width: `min(100%, calc(60vh * ${width / height}))`,
        }}
        onPointerDown={(event) =>
          startDrag(event, { kind: "draw", from: pointAt(event) })
        }
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full object-fill"
        />
        <div
          ref={box}
          role="application"
          tabIndex={0}
          aria-label={t("box", { size })}
          aria-describedby={keysId}
          className="focus-visible:focus-ring absolute cursor-move rounded-sm shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] ring-2 ring-white outline-hidden"
          style={{
            left: `${area.x * 100}%`,
            top: `${area.y * 100}%`,
            width: `${area.width * 100}%`,
            height: `${area.height * 100}%`,
          }}
          onPointerDown={(event) =>
            startDrag(event, {
              kind: "move",
              from: pointAt(event),
              start: area,
            })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onChoose(area);
              return;
            }
            const next = areaAfterKey(area, event.key, event.shiftKey);
            if (!next) return;
            event.preventDefault();
            setArea(next);
            const moved = cropRect(next, width, height);
            setAnnounced(
              t("size", {
                width: String(moved.width),
                height: String(moved.height),
              }),
            );
          }}
        >
          <span className="pointer-events-none absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
            {size}
          </span>
          {HANDLES.map(({ edges, className }) => (
            <span
              key={className}
              aria-hidden="true"
              className={cn(
                "absolute size-3 rounded-sm bg-white ring-1 ring-black/40",
                className,
              )}
              onPointerDown={(event) =>
                startDrag(event, {
                  kind: "resize",
                  edges,
                  from: pointAt(event),
                  start: area,
                })
              }
            />
          ))}
        </div>
      </div>
      <p id={keysId} className="text-muted-foreground text-[13px]">
        {t("keys")}
      </p>
      <p className="sr-only" aria-live="polite">
        {announced}
      </p>
      <DialogFooter>
        <Button variant="outline" onPress={onCancel}>
          {t("cancel")}
        </Button>
        <Button onPress={() => onChoose(area)}>
          {choice.changing ? t("done") : t("share")}
        </Button>
      </DialogFooter>
    </>
  );
}
