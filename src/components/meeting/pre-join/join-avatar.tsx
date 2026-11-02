"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Button as AriaButton } from "react-aria-components";
import { toast } from "sonner";

import { AvatarPicker } from "@/components/avatars/avatar-picker";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { updateProfileAction } from "@/lib/account/actions";
import type { AccountAvatar, PhotoProvider } from "@/lib/avatars/account";
import { avatarImage, withLook } from "@/lib/avatars/seed";

/** Who is about to join: signed in, or a guest (whose name we remember on this device). */
export type Viewer =
  | { kind: "user"; name: string; avatar: AccountAvatar }
  | {
      kind: "guest";
      /** This browser's avatar or, on a first visit, a new one the page made. */
      avatarSeed: string;
      /** No avatar of their own yet: the default follows the name they type. */
      firstVisit: boolean;
    };

/** The avatar you join with, and the ways to change it on the join screen. */
export type JoinAvatar = {
  /** What people see when your camera is off. */
  image: string;
  seed: string;
  usesPhoto: boolean;
  /** Where the account's photo came from, to offer it instead; null for guests. */
  photoProvider: PhotoProvider | null;
  /** Changes save to the account, as in Settings → Account. */
  forAccount: boolean;
  /** What the join request carries: a guest's avatar (accounts keep their own). */
  joinSeed: string | undefined;
  pick: (seed: string) => void;
  setPhoto: (on: boolean) => void;
  /** A first-time guest's default takes the look their name suggests. */
  followName: (name: string) => void;
  /** Joining with it: it's theirs now, so it stops following the name. */
  keep: () => void;
  /**
   * An account's choice on its way to being saved, if one is: joining waits for it, so
   * the meeting shows what the join screen did.
   */
  saving: RefObject<Promise<unknown> | null>;
};

/** The look a name suggests, from a list that's loaded only when it's needed. */
const loadLookForName = () =>
  import("@/lib/avatars/name-look").then((module) => module.lookForName);

/**
 * The avatar shown on the join screen is the one you join with. A guest's travels with
 * the join request, and this browser's guest cookie keeps it; an account's is saved to
 * the account as you choose it. On a first visit a guest's default follows the name
 * they type, until they pick one. Kept above the join screen, so it survives the trip
 * to the room and back.
 */
export function useJoinAvatar(viewer: Viewer): JoinAvatar {
  const t = useTranslations("Avatars");
  const account = viewer.kind === "user" ? viewer.avatar : null;
  const [seed, setSeed] = useState(
    viewer.kind === "user" ? viewer.avatar.seed : viewer.avatarSeed,
  );
  const [usesPhoto, setUsesPhoto] = useState(account?.usesPhoto ?? false);
  // Read once the list of names has loaded, which may be after they've picked one.
  const following = useRef(viewer.kind === "guest" && viewer.firstVisit);
  const saving = useRef<Promise<unknown> | null>(null);

  // Fetch the list while they look at the screen, so their name's look is ready.
  useEffect(() => {
    if (following.current) void loadLookForName();
  }, []);

  async function save(
    change: Record<string, string>,
    before: { seed: string; usesPhoto: boolean },
  ) {
    const request = updateProfileAction(change).catch(() => false);
    saving.current = request;
    const saved = await request;
    if (saving.current === request) saving.current = null;
    if (saved) return;
    setSeed(before.seed);
    setUsesPhoto(before.usesPhoto);
    toast.error(t("saveFailed"));
  }

  return {
    image: usesPhoto && account?.photo ? account.photo.url : avatarImage(seed),
    seed,
    usesPhoto,
    photoProvider: account?.photo?.provider ?? null,
    forAccount: account !== null,
    joinSeed: viewer.kind === "guest" ? seed : undefined,
    pick(next) {
      following.current = false;
      setSeed(next);
      if (!account) return;
      setUsesPhoto(false);
      void save(
        { avatarSeed: next, avatarSource: "dicebear" },
        { seed, usesPhoto },
      );
    },
    setPhoto(on) {
      if (!account) return;
      setUsesPhoto(on);
      void save(
        on
          ? { avatarSource: "provider" }
          : { avatarSeed: seed, avatarSource: "dicebear" },
        { seed, usesPhoto },
      );
    },
    followName(name) {
      if (!following.current) return;
      void loadLookForName().then((lookForName) => {
        if (following.current) {
          setSeed((current) => withLook(current, lookForName(name)));
        }
      });
    },
    keep() {
      following.current = false;
    },
    saving,
  };
}

/** Your avatar beside your name; selecting it opens the choices. */
export function ChangeAvatar({
  avatar,
  isDisabled = false,
}: {
  avatar: JoinAvatar;
  isDisabled?: boolean;
}) {
  const t = useTranslations("Avatars");
  const [open, setOpen] = useState(false);
  return (
    <>
      <TooltipTrigger delay={300}>
        <AriaButton
          aria-label={t("change")}
          isDisabled={isDisabled}
          onPress={() => setOpen(true)}
          className="group focus-visible:focus-ring relative size-12 shrink-0 rounded-full outline-hidden disabled:opacity-60"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar.image}
            alt=""
            className="size-12 rounded-full shadow-[0_0_0_1px_var(--border)]"
          />
          <span
            aria-hidden="true"
            className="bg-foreground text-background group-hover:bg-primary group-hover:text-primary-foreground ring-background absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full ring-2"
          >
            <Pencil className="size-3" />
          </span>
        </AriaButton>
        <Tooltip>{t("change")}</Tooltip>
      </TooltipTrigger>
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        closeLabel={t("close")}
        className="sm:max-w-[400px]"
      >
        <DialogHeader>
          <DialogTitle className="pr-8 text-lg font-semibold">
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {avatar.forAccount ? t("forAccount") : t("forGuest")}
          </DialogDescription>
        </DialogHeader>
        <AvatarPicker
          seed={avatar.seed}
          usesPhoto={avatar.usesPhoto}
          photoProvider={avatar.photoProvider}
          onPick={avatar.pick}
          onUsePhoto={avatar.setPhoto}
        />
        <DialogFooter>
          <DialogClose variant="default">{t("done")}</DialogClose>
        </DialogFooter>
      </Dialog>
    </>
  );
}
