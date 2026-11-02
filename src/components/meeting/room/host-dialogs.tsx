"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

import type { RoomParticipant } from "../media";

/** "Remove Ana?": removing someone can't be undone for this meeting, so it asks first. */
export function RemoveDialog({
  participant,
  onRemove,
  onClose,
}: {
  participant: RoomParticipant | null;
  onRemove: (participant: RoomParticipant) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Meeting.moderation");
  return (
    <Dialog
      isOpen={participant !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      role="alertdialog"
      closeLabel={t("cancel")}
      showCloseButton={false}
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          {t("removeTitle", { name: participant?.name ?? "" })}
        </DialogTitle>
        <DialogDescription>{t("removeBody")}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onPress={onClose} autoFocus>
          {t("cancel")}
        </Button>
        <Button
          variant="destructive"
          onPress={() => {
            if (participant) onRemove(participant);
            onClose();
          }}
        >
          {t("removeConfirm")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/** Mute all, as in Zoom: everyone but hosts, with a choice about unmuting themselves. */
export function MuteAllDialog({
  isOpen,
  selfUnmute,
  onMuteAll,
  onClose,
}: {
  isOpen: boolean;
  /** The current policy, which the switch starts from. */
  selfUnmute: boolean;
  onMuteAll: (selfUnmute: boolean) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Meeting.moderation");
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      closeLabel={t("cancel")}
    >
      {/* Mounted per opening, so the switch starts from the current policy. */}
      {isOpen ? (
        <MuteAllForm
          selfUnmute={selfUnmute}
          onMuteAll={(allow) => {
            onMuteAll(allow);
            onClose();
          }}
          onCancel={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function MuteAllForm({
  selfUnmute,
  onMuteAll,
  onCancel,
}: {
  selfUnmute: boolean;
  onMuteAll: (selfUnmute: boolean) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Meeting.moderation");
  const [allow, setAllow] = useState(selfUnmute);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          {t("muteAllTitle")}
        </DialogTitle>
        <DialogDescription>{t("muteAllBody")}</DialogDescription>
      </DialogHeader>
      <Switch
        isSelected={allow}
        onChange={setAllow}
        className="text-sm font-medium"
      >
        {t("muteAllLetUnmute")}
      </Switch>
      <DialogFooter>
        <Button variant="outline" onPress={onCancel}>
          {t("cancel")}
        </Button>
        <Button onPress={() => onMuteAll(allow)} autoFocus>
          {t("muteAllConfirm")}
        </Button>
      </DialogFooter>
    </>
  );
}

/** One person shares at a time: a host taking over asks first, as in Meet. */
export function TakeoverDialog({
  presenterName,
  onConfirm,
  onClose,
}: {
  /** Who's sharing now; null keeps the dialog closed. */
  presenterName: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("Meeting.share");
  const name = presenterName ?? "";
  return (
    <Dialog
      isOpen={presenterName !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      role="alertdialog"
      showCloseButton={false}
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          {t("someoneSharing", { name })}
        </DialogTitle>
        <DialogDescription>{t("takeoverBody", { name })}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onPress={onClose}>
          {t("cancel")}
        </Button>
        <Button onPress={onConfirm} autoFocus>
          {t("takeover")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/** A host asked you to unmute: you decide, as in Zoom. */
export function UnmuteRequestDialog({
  isOpen,
  onUnmute,
  onClose,
}: {
  isOpen: boolean;
  onUnmute: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("Meeting.hostActions");
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      role="alertdialog"
      showCloseButton={false}
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          {t("unmuteRequestTitle")}
        </DialogTitle>
        <DialogDescription>{t("unmuteRequestBody")}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onPress={onClose}>
          {t("stayMuted")}
        </Button>
        <Button
          onPress={() => {
            onUnmute();
            onClose();
          }}
          autoFocus
        >
          {t("unmute")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
