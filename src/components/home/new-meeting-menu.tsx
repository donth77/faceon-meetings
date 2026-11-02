"use client";

import { CalendarPlus, Link2, LoaderCircle, Plus, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type Key } from "react";
import { toast } from "sonner";

import { inviteLink } from "@/components/meeting/invitation";
import { Button, LinkButton } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useOrigin } from "@/hooks/use-origin";
import { copyText } from "@/lib/clipboard";
import { createInstantMeeting } from "@/lib/meetings/actions";

type Created = { code: string; passcode: string | null };

/** "Here's the link to your meeting", with Copy link and Start now, as in Meet. */
function MeetingLinkDialog({
  meeting,
  onClose,
}: {
  meeting: Created;
  onClose: () => void;
}) {
  const t = useTranslations("Home");
  const link = inviteLink(useOrigin(), meeting);

  const copy = () =>
    copyText(link, { copied: t("linkCopied"), failed: t("copyFailed") });

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      showCloseButton={false}
      className="sm:max-w-md"
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          {t("laterTitle")}
        </DialogTitle>
        <DialogDescription>{t("laterBody")}</DialogDescription>
      </DialogHeader>
      <div className="flex gap-2">
        <Input
          aria-label={t("linkLabel")}
          value={link}
          readOnly
          onFocus={(event) => event.target.select()}
          className="h-10 min-w-0 flex-1"
        />
        <Button onPress={() => void copy()} size="lg" className="h-10">
          <Link2 aria-hidden="true" />
          {t("copyLink")}
        </Button>
      </div>
      <DialogFooter>
        <Button variant="outline" slot="close">
          {t("close")}
        </Button>
        <LinkButton href={`/j/${meeting.code}`}>{t("startNow")}</LinkButton>
      </DialogFooter>
    </Dialog>
  );
}

/**
 * Meet-style "New meeting" menu: start an instant meeting, create one for later and
 * share its link, or schedule one.
 */
export function NewMeetingMenu() {
  const t = useTranslations("Home");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<Created | null>(null);

  function handleAction(key: Key) {
    if (key === "schedule") {
      router.push("/schedule");
      return;
    }
    if (key !== "instant" && key !== "later") return;
    startTransition(async () => {
      try {
        const result = await createInstantMeeting();
        if (!result.ok) toast.error(t("dailyLimit"));
        else if (key === "instant") router.push(`/j/${result.code}`);
        else setCreated(result);
      } catch {
        toast.error(t("createFailed"));
      }
    });
  }

  return (
    <>
      <DropdownMenuTrigger>
        <Button size="lg" className="gap-2" isPending={pending}>
          {pending ? (
            <LoaderCircle
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {pending ? t("starting") : t("newMeeting")}
        </Button>
        <DropdownMenu
          placement="bottom start"
          className="min-w-64"
          onAction={handleAction}
        >
          <DropdownMenuItem id="instant" textValue={t("startInstant")}>
            <Video aria-hidden="true" />
            {t("startInstant")}
          </DropdownMenuItem>
          <DropdownMenuItem id="later" textValue={t("createForLater")}>
            <Link2 aria-hidden="true" />
            {t("createForLater")}
          </DropdownMenuItem>
          <DropdownMenuItem id="schedule" textValue={t("schedule")}>
            <CalendarPlus aria-hidden="true" />
            {t("schedule")}
          </DropdownMenuItem>
        </DropdownMenu>
      </DropdownMenuTrigger>
      {created ? (
        <MeetingLinkDialog meeting={created} onClose={() => setCreated(null)} />
      ) : null}
    </>
  );
}
