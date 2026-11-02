"use client";

import { Ellipsis } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Popover,
  Radio,
  RadioGroup,
} from "react-aria-components";

import { Switch } from "@/components/ui/switch";
import type { SharedSessionState } from "@/lib/meetings/events";
import type { SessionPolicy } from "@/lib/meetings/policy";

function SettingSwitch({
  label,
  help,
  isSelected,
  isDisabled,
  onChange,
}: {
  label: string;
  help?: string;
  isSelected: boolean;
  isDisabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const helpId = useId();
  return (
    <div className="flex items-center gap-3 rounded-[10px] px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{label}</span>
        {help ? (
          <span id={helpId} className="text-muted-foreground text-[13px]">
            {help}
          </span>
        ) : null}
      </div>
      <Switch
        isSelected={isSelected}
        isDisabled={isDisabled}
        onChange={onChange}
        aria-label={label}
        aria-describedby={help ? helpId : undefined}
      />
    </div>
  );
}

/** "Start AI notes automatically", which the meeting's host can change from the room. */
/** "Start AI notes automatically": for the meeting's host, where their meetings offer AI notes. */
export type AutoNotesSetting = {
  on: boolean;
  onChange: (on: boolean) => void;
};

/**
 * Meeting settings, for hosts and co-hosts (Participants › ⋯): lock the meeting, the
 * waiting room, chat, reactions, unmuting, who can share, and End meeting for all.
 * Changes last until the session ends; the server enforces each one. The meeting's host
 * also sets whether AI notes start automatically, which stays with the meeting.
 */
export function MeetingSettingsMenu({
  state,
  isOwner,
  onChange,
  autoNotes,
  onEndForAll,
}: {
  state: SharedSessionState | null;
  /** Only the meeting's owner can end it for everyone. */
  isOwner: boolean;
  onChange: (policy: Partial<SessionPolicy>) => void;
  autoNotes?: AutoNotesSetting | undefined;
  onEndForAll: () => void;
}) {
  const t = useTranslations("Meeting.meetingSettings");
  const shareLabelId = useId();
  const disabled = state === null;

  return (
    <DialogTrigger>
      <Button
        aria-label={t("more")}
        className="focus-visible:focus-ring flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-white/10 outline-hidden hover:bg-white/15"
      >
        <Ellipsis className="size-5" aria-hidden="true" />
      </Button>
      <Popover
        placement="top end"
        offset={8}
        className="w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#1c2026] p-2 shadow-[0_20px_48px_rgba(0,0,0,0.55)] ring-1 ring-[#2f3640]"
      >
        <Dialog aria-label={t("title")} className="flex flex-col outline-none">
          {({ close }) => (
            <>
              <SettingSwitch
                label={t("lock")}
                help={t("lockHelp")}
                isSelected={state?.locked ?? false}
                isDisabled={disabled}
                onChange={(locked) => onChange({ locked })}
              />
              <SettingSwitch
                label={t("waitingRoom")}
                help={t("waitingRoomHelp")}
                isSelected={state?.waitingRoom ?? false}
                isDisabled={disabled}
                onChange={(waitingRoom) => onChange({ waitingRoom })}
              />
              <SettingSwitch
                label={t("chat")}
                isSelected={state?.chat ?? true}
                isDisabled={disabled}
                onChange={(chat) => onChange({ chat })}
              />
              <SettingSwitch
                label={t("reactions")}
                isSelected={state?.reactions ?? true}
                isDisabled={disabled}
                onChange={(reactions) => onChange({ reactions })}
              />
              <SettingSwitch
                label={t("unmute")}
                isSelected={state?.selfUnmute ?? true}
                isDisabled={disabled}
                onChange={(selfUnmute) => onChange({ selfUnmute })}
              />
              <div className="flex flex-col gap-2 px-3 pt-2 pb-3">
                <span className="text-[15px] font-semibold" id={shareLabelId}>
                  {t("share")}
                </span>
                <RadioGroup
                  aria-labelledby={shareLabelId}
                  orientation="horizontal"
                  value={state?.screenShare ?? "all"}
                  isDisabled={disabled}
                  onChange={(value) =>
                    onChange({ screenShare: value === "host" ? "host" : "all" })
                  }
                  className="bg-background flex rounded-[10px] p-[3px]"
                >
                  <Radio
                    value="all"
                    className="data-focus-visible:focus-ring flex-1 rounded-lg py-1.5 text-center text-sm font-semibold text-white/70 outline-hidden data-selected:bg-white/15 data-selected:text-white data-selected:ring-1 data-selected:ring-white/70"
                  >
                    {t("shareEveryone")}
                  </Radio>
                  <Radio
                    value="host"
                    className="data-focus-visible:focus-ring flex-1 rounded-lg py-1.5 text-center text-sm font-semibold text-white/70 outline-hidden data-selected:bg-white/15 data-selected:text-white data-selected:ring-1 data-selected:ring-white/70"
                  >
                    {t("shareHosts")}
                  </Radio>
                </RadioGroup>
              </div>
              {autoNotes ? (
                <SettingSwitch
                  label={t("autoNotes")}
                  help={t("autoNotesHelp")}
                  isSelected={autoNotes.on}
                  isDisabled={false}
                  onChange={autoNotes.onChange}
                />
              ) : null}
              {isOwner ? (
                <Button
                  onPress={onEndForAll}
                  className="text-destructive-text focus-visible:focus-ring m-1 h-[42px] rounded-[10px] bg-[#3a1d20] text-[15px] font-bold outline-hidden hover:bg-[#46222a]"
                >
                  {t("endForAll")}
                </Button>
              ) : null}
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
