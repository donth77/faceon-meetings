"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { Switch } from "@/components/ui/switch";
import type { SharedSessionState } from "@/lib/meetings/events";
import type { SessionPolicy } from "@/lib/meetings/policy";

import { SidePanel } from "./side-panel";

function PolicySwitch({
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
    <li className="flex items-center gap-3 px-5 py-2.5">
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {help ? (
          <span id={helpId} className="text-muted-foreground block text-xs">
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
    </li>
  );
}

/**
 * Host controls, as in Meet: lock the meeting, and what everyone else may do. Hosts and
 * co-hosts can always share, chat, react and unmute.
 */
export function HostControlsPanel({
  state,
  onChange,
  onClose,
}: {
  state: SharedSessionState | null;
  onChange: (policy: Partial<SessionPolicy>) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Meeting.hostControls");
  const disabled = state === null;

  return (
    <SidePanel title={t("title")} closeLabel={t("close")} onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <h3 className="text-muted-foreground px-5 pt-1 pb-1 text-xs font-bold tracking-[0.06em] uppercase">
          {t("meeting")}
        </h3>
        <ul>
          <PolicySwitch
            label={t("lock")}
            help={t("lockHelp")}
            isSelected={state?.locked ?? false}
            isDisabled={disabled}
            onChange={(locked) => onChange({ locked })}
          />
        </ul>
        <h3 className="text-muted-foreground px-5 pt-4 pb-1 text-xs font-bold tracking-[0.06em] uppercase">
          {t("letEveryone")}
        </h3>
        <ul>
          <PolicySwitch
            label={t("shareScreen")}
            isSelected={state?.screenShare !== "host"}
            isDisabled={disabled}
            onChange={(all) => onChange({ screenShare: all ? "all" : "host" })}
          />
          <PolicySwitch
            label={t("chat")}
            isSelected={state?.chat ?? true}
            isDisabled={disabled}
            onChange={(chat) => onChange({ chat })}
          />
          <PolicySwitch
            label={t("reactions")}
            isSelected={state?.reactions ?? true}
            isDisabled={disabled}
            onChange={(reactions) => onChange({ reactions })}
          />
          <PolicySwitch
            label={t("unmute")}
            help={t("unmuteHelp")}
            isSelected={state?.selfUnmute ?? true}
            isDisabled={disabled}
            onChange={(selfUnmute) => onChange({ selfUnmute })}
          />
        </ul>
      </div>
    </SidePanel>
  );
}
