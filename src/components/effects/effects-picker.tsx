"use client";

import { cn } from "cn";
import {
  Ban,
  Check,
  Film,
  LoaderCircle,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button, FileTrigger, Radio, RadioGroup } from "react-aria-components";
import { toast } from "sonner";

import {
  BLUR_LEVELS,
  effectFromKey,
  effectKey,
  MOTIONS,
  motionThumb,
  STILL_GROUPS,
  STILLS,
  stillThumb,
  type BlurLevel,
  type Effect,
} from "@/lib/effects/effects";
import { footageSupported } from "@/lib/effects/support";
import {
  addUpload,
  removeUpload,
  UPLOAD_LIMITS,
  UPLOAD_TYPES,
  UploadRejected,
} from "@/lib/effects/uploads";
import { publicEnv } from "@/lib/env";

import type { ShownUpload } from "./use-uploads";

const subscribeNever = () => () => {};

/** Focus is an outline around the tile; the chosen one also has a ring and a check. */
const TILE =
  "group relative block aspect-video overflow-hidden rounded-lg bg-[#1a1f26] ring-1 ring-black/10 outline-hidden data-focus-visible:focus-ring-strong data-selected:ring-[3px] data-selected:ring-primary dark:ring-white/10";

function Tile({
  value,
  label,
  moving = false,
  children,
}: {
  value: string;
  label: string;
  /** A moving background, marked with a small film badge. */
  moving?: boolean;
  children: ReactNode;
}) {
  return (
    <Radio value={value} aria-label={label} className={TILE}>
      {children}
      {moving ? (
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white"
        >
          <Film className="size-3" />
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground absolute top-1 right-1 hidden size-5 items-center justify-center rounded-full shadow group-data-selected:flex"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    </Radio>
  );
}

/** A background's still, filling its tile. */
function Thumb({ src, lazy = false }: { src: string; lazy?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading={lazy ? "lazy" : undefined}
      className="absolute inset-0 size-full object-cover"
    />
  );
}

function Group({
  label,
  hideLabel = false,
  children,
}: {
  label: string;
  /** Named for screen readers only, as the first row (no effect and the blurs) is. */
  hideLabel?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={hideLabel ? undefined : id}
      aria-label={hideLabel ? label : undefined}
      className="flex flex-col gap-2"
    >
      {hideLabel ? null : (
        <span
          id={id}
          className="text-muted-foreground text-xs font-bold tracking-[0.06em] uppercase"
        >
          {label}
        </span>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2 @lg:grid-cols-[repeat(auto-fill,minmax(96px,1fr))]">
        {children}
      </div>
    </div>
  );
}

/** No effect, or a blur: a figure in front of a scene, the scene sharp or blurred. */
function BlurArt({ level }: { level: BlurLevel | null }) {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 flex items-end justify-center overflow-hidden bg-[#2a323d]"
    >
      {level ? (
        <span
          className={cn(
            "absolute -inset-2 bg-[radial-gradient(circle_at_18%_30%,#7aa2ff_0,transparent_32%),radial-gradient(circle_at_82%_22%,#f2b200_0,transparent_26%),radial-gradient(circle_at_68%_78%,#1db46b_0,transparent_34%)]",
            level === "slight" ? "blur-[2px]" : "blur-[6px]",
          )}
        />
      ) : (
        <Ban className="absolute top-1/2 left-1/2 size-7 -translate-1/2 text-white/85" />
      )}
      {level ? (
        <UserRound
          className="relative -mb-1.5 size-12 text-white"
          strokeWidth={1.75}
        />
      ) : null}
    </span>
  );
}

/**
 * Every background and effect, as one set of choices (arrow keys move between them):
 * no effect and blurs, the default stills, motion (where this browser plays it), and
 * the ones added on this device, which can be added and removed here.
 */
export function EffectsPicker({
  value,
  uploads,
  onChange,
}: {
  value: Effect | null;
  uploads: ShownUpload[];
  onChange: (effect: Effect | null) => void;
}) {
  const t = useTranslations("Effects");
  const [adding, setAdding] = useState(false);
  const playsFootage = useSyncExternalStore(
    subscribeNever,
    footageSupported,
    () => false,
  );
  const selected = effectKey(value);

  async function add(file: File) {
    setAdding(true);
    try {
      const upload = await addUpload(file);
      onChange({ kind: "upload", id: upload.id });
    } catch (error) {
      const problem =
        error instanceof UploadRejected ? error.problem : "unreadable";
      toast.error(
        t(`rejected.${problem}`, {
          seconds: UPLOAD_LIMITS.videoSeconds,
          appName: publicEnv.NEXT_PUBLIC_APP_NAME,
        }),
      );
    } finally {
      setAdding(false);
    }
  }

  async function remove(upload: ShownUpload) {
    if (selected === effectKey({ kind: "upload", id: upload.id })) {
      onChange(null);
    }
    await removeUpload(upload.id).catch(() => {});
  }

  return (
    <RadioGroup
      aria-label={t("choices")}
      value={selected}
      onChange={(key) => onChange(effectFromKey(key))}
      className="flex flex-col gap-4"
    >
      <Group label={t("groups.effects")} hideLabel>
        <Tile value="none" label={t("none")}>
          <BlurArt level={null} />
        </Tile>
        {BLUR_LEVELS.map((level) => (
          <Tile
            key={level}
            value={effectKey({ kind: "blur", level })}
            label={t(`blur.${level}`)}
          >
            <BlurArt level={level} />
          </Tile>
        ))}
      </Group>
      {STILL_GROUPS.map((group) => (
        <Group key={group} label={t(`groups.${group}`)}>
          {STILLS.filter((still) => still.group === group).map((still) => (
            <Tile
              key={still.id}
              value={effectKey({ kind: "still", id: still.id })}
              label={t(`stills.${still.id}`)}
            >
              <Thumb src={stillThumb(still.id)} lazy />
            </Tile>
          ))}
        </Group>
      ))}
      {playsFootage ? (
        <Group label={t("groups.motion")}>
          {MOTIONS.map(({ id }) => (
            <Tile
              key={id}
              value={effectKey({ kind: "motion", id })}
              label={t(`motion.${id}`)}
              moving
            >
              <Thumb src={motionThumb(id)} lazy />
            </Tile>
          ))}
        </Group>
      ) : null}
      <Group label={t("groups.yours")}>
        <FileTrigger
          acceptedFileTypes={UPLOAD_TYPES}
          onSelect={(files) => {
            const file = files?.[0];
            if (file) void add(file);
          }}
        >
          <Button
            isPending={adding}
            className="text-muted-foreground hover:text-foreground data-focus-visible:focus-ring-strong flex aspect-video flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-current/40 text-xs font-semibold outline-hidden"
          >
            {adding ? (
              <LoaderCircle
                className="size-5 animate-spin motion-reduce:animate-none"
                aria-label={t("adding")}
              />
            ) : (
              <Plus className="size-5" aria-hidden="true" />
            )}
            {t("add")}
          </Button>
        </FileTrigger>
        {uploads.map((upload) => {
          const name = t(
            upload.kind === "image" ? "uploadImage" : "uploadVideo",
            { n: upload.number },
          );
          return (
            <div key={upload.id} className="relative">
              <Tile
                value={effectKey({ kind: "upload", id: upload.id })}
                label={name}
                moving={upload.kind === "video"}
              >
                <Thumb src={upload.thumbUrl} />
              </Tile>
              <Button
                aria-label={t("remove", { name })}
                onPress={() => void remove(upload)}
                className="absolute top-1 left-1 flex size-6 items-center justify-center rounded-full bg-black/65 text-white outline-none hover:bg-black/85 data-focus-visible:outline-2 data-focus-visible:outline-offset-1 data-focus-visible:outline-white"
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          );
        })}
      </Group>
      <p className="text-muted-foreground text-xs leading-normal">
        {t("addHelp", {
          imageMegabytes: UPLOAD_LIMITS.imageMegabytes,
          videoMegabytes: UPLOAD_LIMITS.videoMegabytes,
          videoSeconds: UPLOAD_LIMITS.videoSeconds,
        })}
      </p>
    </RadioGroup>
  );
}
