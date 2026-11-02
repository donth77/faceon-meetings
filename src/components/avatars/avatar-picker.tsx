"use client";

import { Check, Shuffle, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Radio, RadioGroup, ToggleButton } from "react-aria-components";

import { Button } from "@/components/ui/button";
import type { PhotoProvider } from "@/lib/avatars/account";
import {
  avatarImage,
  createAvatarSeed,
  parseAvatarSeed,
} from "@/lib/avatars/seed";

const OUTLINE =
  "h-[38px] gap-2 rounded-[10px] border-[#c9cfd8] px-3.5 text-sm font-semibold dark:border-white/15";

/** Seven more avatars with the look of this one. */
const moreLike = (seed: string) => {
  const look = parseAvatarSeed(seed)?.look ?? "n";
  return Array.from({ length: 7 }, () => createAvatarSeed(look));
};

/**
 * Choosing an avatar: yours and seven more, Shuffle for new ones, and the photo a Google
 * or GitHub sign-in brought, where there is one. Settings → Account and the join screen
 * both use it; what a choice does (save it to the account, or keep it for joining) is
 * theirs.
 */
export function AvatarPicker({
  seed,
  usesPhoto = false,
  photoProvider = null,
  choices,
  onPick,
  onUsePhoto,
}: {
  /** The avatar chosen now. */
  seed: string;
  /** The account's photo is chosen instead. */
  usesPhoto?: boolean;
  /** Where the account's photo came from, to offer it; null without one. */
  photoProvider?: PhotoProvider | null;
  /**
   * More avatars beside yours. A page rendered on the server makes them there, so both
   * renders match; otherwise they're made here.
   */
  choices?: readonly string[];
  onPick: (seed: string) => void;
  onUsePhoto?: (on: boolean) => void;
}) {
  const t = useTranslations("Avatars");
  const labelId = useId();
  const [seeds, setSeeds] = useState(() => [
    seed,
    ...(choices ?? moreLike(seed)),
  ]);
  // Yours stays first: a first-time guest's default follows their name, so it can change.
  const shown = seeds.includes(seed) ? seeds : [seed, ...seeds.slice(1)];

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <RadioGroup
        value={usesPhoto ? null : seed}
        onChange={onPick}
        orientation="horizontal"
        aria-labelledby={labelId}
      >
        <span id={labelId} className="mb-3 block text-sm font-semibold">
          {t("pick")}
        </span>
        <div className="flex flex-wrap gap-3.5">
          {shown.map((option, index) => (
            <Radio
              key={option}
              value={option}
              aria-label={t("option", { n: index + 1 })}
              className="group data-focus-visible:focus-ring-strong relative size-16 rounded-full outline-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarImage(option)}
                alt=""
                className="size-16 rounded-full shadow-[0_0_0_1px_var(--border)] group-data-selected:shadow-[0_0_0_3px_var(--card),0_0_0_5px_var(--primary)]"
              />
              <span className="bg-primary text-primary-foreground absolute -right-0.5 -bottom-0.5 hidden size-[22px] items-center justify-center rounded-full shadow-[0_0_0_2px_var(--card)] group-data-selected:flex">
                <Check className="size-3.5" aria-hidden="true" />
              </span>
            </Radio>
          ))}
        </div>
      </RadioGroup>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className={OUTLINE}
          // Keeps the avatar you have, with seven new ones beside it.
          onPress={() => setSeeds([seed, ...moreLike(seed)])}
        >
          <Shuffle className="size-[18px]" aria-hidden="true" />
          {t("shuffle")}
        </Button>
        {photoProvider && onUsePhoto ? (
          <ToggleButton
            isSelected={usesPhoto}
            onChange={onUsePhoto}
            className="bg-background hover:bg-muted border-input data-selected:border-primary data-selected:bg-chip data-selected:text-chip-foreground data-focus-visible:focus-ring flex h-[38px] items-center gap-2 rounded-[10px] border px-3.5 text-sm font-semibold whitespace-nowrap outline-hidden"
          >
            <User className="size-[18px]" aria-hidden="true" />
            {t("usePhoto", { provider: photoProvider })}
          </ToggleButton>
        ) : null}
      </div>
    </div>
  );
}
