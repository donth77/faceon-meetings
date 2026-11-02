"use client";

import { Copy, Eye, EyeOff, RefreshCw, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { ToggleButton } from "react-aria-components";
import { toast } from "sonner";

import { useInvitation } from "@/components/meeting/invitation";
import { Button, LinkButton } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SwitchRow } from "@/components/ui/form-fields";
import {
  regeneratePersonalRoom,
  updatePersonalRoomSettings,
} from "@/lib/meetings/actions";
import { formatMeetingCode } from "@/lib/meetings/codes";

export type PersonalRoom = {
  code: string;
  passcode: string | null;
  title: string | null;
  hostName: string;
  settings: {
    waitingRoom: boolean;
    allowGuests: boolean;
    muteOnEntry: boolean;
  };
};

type Setting = keyof PersonalRoom["settings"];

const card =
  "bg-card ring-border flex flex-col gap-3.5 rounded-2xl px-6 py-5.5 ring-1";

async function copyText(text: string, done: string, failed: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error(failed);
  }
}

function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b py-3 last:border-b-0">
      <span
        id={id}
        className="text-muted-foreground w-40 shrink-0 text-sm font-semibold"
      >
        {label}
      </span>
      <span
        aria-labelledby={id}
        className="min-w-0 flex-[1_1_220px] font-mono text-[15px] break-all"
      >
        {value}
      </span>
      <div className="flex gap-1.5">{children}</div>
    </div>
  );
}

/**
 * The personal room: its Personal Meeting ID, passcode and link to share, Start, a way
 * to get a new ID when the old one has spread too far, and the room's settings.
 */
export function PersonalRoomView({ room: initial }: { room: PersonalRoom }) {
  const t = useTranslations("PersonalRoom");
  const [room, setRoom] = useState(initial);
  const [showPasscode, setShowPasscode] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { link, copyInvitation } = useInvitation(room);

  const copy = (text: string) =>
    void copyText(text, t("copied"), t("copyFailed"));

  async function regenerate() {
    setRegenerating(true);
    try {
      const fresh = await regeneratePersonalRoom();
      setRoom((current) => ({ ...current, ...fresh }));
      setConfirming(false);
      toast.success(t("regenerated"));
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setRegenerating(false);
    }
  }

  async function changeSetting(setting: Setting, value: boolean) {
    const previous = room.settings[setting];
    setRoom((current) => ({
      ...current,
      settings: { ...current.settings, [setting]: value },
    }));
    const saved = await updatePersonalRoomSettings({ [setting]: value }).catch(
      () => false,
    );
    if (!saved) {
      setRoom((current) => ({
        ...current,
        settings: { ...current.settings, [setting]: previous },
      }));
      toast.error(t("saveFailed"));
    }
  }

  return (
    <main className="flex flex-1 flex-col p-6 md:p-10">
      <div className="flex max-w-[900px] flex-col gap-5.5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground max-w-[60ch] text-[15px] leading-normal">
              {t("subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <LinkButton href={`/j/${room.code}`} size="lg">
              <Video aria-hidden="true" />
              {t("start")}
            </LinkButton>
            <Button
              variant="outline"
              size="lg"
              onPress={() => void copyInvitation()}
            >
              <Copy aria-hidden="true" />
              {t("copyInvitation")}
            </Button>
          </div>
        </div>

        <section aria-labelledby="room-details" className={card}>
          <h2 id="room-details" className="text-lg font-bold">
            {t("joinDetails")}
          </h2>
          <div>
            <DetailRow
              label={t("meetingId")}
              value={formatMeetingCode(room.code)}
            >
              <Button
                variant="outline"
                aria-label={t("copyMeetingId")}
                onPress={() => copy(room.code)}
              >
                <Copy aria-hidden="true" />
                {t("copy")}
              </Button>
            </DetailRow>
            {room.passcode ? (
              <DetailRow
                label={t("passcode")}
                value={showPasscode ? room.passcode : "••••••"}
              >
                <ToggleButton
                  isSelected={showPasscode}
                  onChange={setShowPasscode}
                  aria-label={t("showPasscode")}
                  className="hover:bg-muted focus-visible:ring-ring flex size-8 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
                >
                  {showPasscode ? (
                    <EyeOff className="size-[18px]" aria-hidden="true" />
                  ) : (
                    <Eye className="size-[18px]" aria-hidden="true" />
                  )}
                </ToggleButton>
                <Button
                  variant="outline"
                  aria-label={t("copyPasscode")}
                  onPress={() => copy(room.passcode ?? "")}
                >
                  <Copy aria-hidden="true" />
                  {t("copy")}
                </Button>
              </DetailRow>
            ) : null}
            <DetailRow
              label={t("inviteLink")}
              // Shown without the protocol or the passcode, which stays masked above.
              value={link.replace(/^https?:\/\//, "").replace(/#.*$/, "")}
            >
              <Button
                variant="outline"
                aria-label={t("copyLink")}
                onPress={() => copy(link)}
              >
                <Copy aria-hidden="true" />
                {t("copy")}
              </Button>
            </DetailRow>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-muted-foreground text-sm">
              {t("regenerateNote")}
            </p>
            <Button
              variant="outline"
              className="text-destructive"
              onPress={() => setConfirming(true)}
            >
              <RefreshCw aria-hidden="true" />
              {t("regenerate")}
            </Button>
          </div>
        </section>

        <section aria-labelledby="room-settings" className={card}>
          <h2 id="room-settings" className="text-lg font-bold">
            {t("settings")}
          </h2>
          <div className="divide-y">
            <SwitchRow
              label={t("waitingRoom")}
              help={t("waitingRoomHint")}
              isSelected={room.settings.waitingRoom}
              onChange={(value) => void changeSetting("waitingRoom", value)}
            />
            <SwitchRow
              label={t("allowGuests")}
              help={t("allowGuestsHint")}
              isSelected={room.settings.allowGuests}
              onChange={(value) => void changeSetting("allowGuests", value)}
            />
            <SwitchRow
              label={t("muteOnEntry")}
              help={t("muteOnEntryHint")}
              isSelected={room.settings.muteOnEntry}
              onChange={(value) => void changeSetting("muteOnEntry", value)}
            />
          </div>
        </section>
      </div>

      <Dialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        closeLabel={t("cancel")}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {t("regenerateTitle")}
          </DialogTitle>
          <DialogDescription>{t("regenerateBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" slot="close">
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            isPending={regenerating}
            onPress={() => void regenerate()}
          >
            {t("regenerateConfirm")}
          </Button>
        </DialogFooter>
      </Dialog>
    </main>
  );
}
