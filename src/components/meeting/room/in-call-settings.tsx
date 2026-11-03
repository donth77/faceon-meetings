"use client";

import {
  Accessibility,
  Bell,
  Mic,
  Settings,
  SmilePlus,
  Sparkles,
  Video,
  VideoOff,
  Volume2,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, use } from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";

import { MicMeter } from "@/components/device/mic-meter";
import { MirroredVideo } from "@/components/device/mirrored-video";
import {
  AudioPreferenceRows,
  VideoPreferenceRows,
} from "@/components/device/preference-rows";
import { EffectsChooser } from "@/components/effects/effects-chooser";
import { AccessibilitySettings } from "@/components/settings/accessibility-settings";
import { AiNotesSettings } from "@/components/settings/ai-notes-settings";
import { DeviceField } from "@/components/settings/device-fields";
import { GeneralSettings } from "@/components/settings/general-settings";
import { NotificationsSettings } from "@/components/settings/notifications-settings";
import { ReactionsSettings } from "@/components/settings/reactions-settings";
import { SettingsChrome } from "@/components/settings/settings-nav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { useCapability } from "@/hooks/use-capability";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  loadDevicePreferences,
  saveDevicePreferences,
  type DevicePreferences,
} from "@/lib/device/preferences";
import { playTestSound } from "@/lib/device/test-sound";
import { aiNotesEnabled } from "@/lib/env";
import { oneOf } from "@/lib/narrow";
import { setPreference, usePreferences, withDefaults } from "@/lib/preferences";

import { useRoomMedia, type InputDevice, type RoomMedia } from "../media";

export type InCallSection =
  | "audio"
  | "video"
  | "reactions"
  | "notifications"
  | "effects"
  | "general"
  | "accessibility"
  | "aiNotes";

const SECTIONS: Array<{ id: InCallSection; icon: LucideIcon }> = [
  { id: "audio", icon: Mic },
  { id: "video", icon: Video },
  { id: "reactions", icon: SmilePlus },
  { id: "notifications", icon: Bell },
  { id: "effects", icon: WandSparkles },
  { id: "general", icon: Settings },
  { id: "accessibility", icon: Accessibility },
  // A copy can turn AI notes off; their settings go with them.
  ...(aiNotesEnabled ? [{ id: "aiNotes" as const, icon: Sparkles }] : []),
];

/**
 * The microphone, speaker and camera Settings shows and changes: the room's during a
 * meeting, or the join screen's preview before it (where choices apply as you join).
 */
export type SettingsDevices = {
  mic: Pick<InputDevice, "track" | "devices" | "selectedId"> & {
    select: (deviceId: string) => void | Promise<void>;
  };
  camera: Pick<
    InputDevice,
    "track" | "enabled" | "allowed" | "devices" | "selectedId"
  > & {
    select: (deviceId: string) => void | Promise<void>;
    toggle: () => void | Promise<void>;
  };
  speaker: RoomMedia["speaker"];
};

const DevicesContext = createContext<SettingsDevices | null>(null);

function useDevices(): SettingsDevices {
  const devices = use(DevicesContext);
  if (!devices) throw new Error("Settings' devices are missing.");
  return devices;
}

/** The device the next meeting starts with follows what you pick here. */
const remember = (patch: Partial<DevicePreferences>) =>
  saveDevicePreferences({ ...loadDevicePreferences(), ...patch });

function AudioSection() {
  const t = useTranslations("Settings.audio");
  const { mic, speaker } = useDevices();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex max-w-[480px] flex-col gap-3">
        <DeviceField
          label={t("microphone")}
          devices={mic.devices}
          value={mic.selectedId}
          onChange={(micId) => {
            void mic.select(micId);
            remember({ micId });
          }}
        />
        <MicMeter track={mic.track} />
      </div>
      <div className="flex flex-wrap items-end gap-2.5">
        {speaker.supported ? (
          <div className="min-w-0 flex-[1_1_320px] sm:max-w-[480px]">
            <DeviceField
              label={t("speaker")}
              devices={speaker.devices}
              value={speaker.selectedId}
              onChange={(speakerId) => {
                speaker.select(speakerId);
                remember({ speakerId });
              }}
            />
          </div>
        ) : null}
        <Button
          variant="secondary"
          className="h-11 gap-2 rounded-[10px] px-4 text-sm font-semibold"
          onPress={() => void playTestSound(speaker.selectedId).catch(() => {})}
        >
          <Volume2 className="size-[18px]" aria-hidden="true" />
          {t("testSpeaker")}
        </Button>
      </div>
      {speaker.supported ? null : (
        <p className="text-muted-foreground -mt-2 text-[13px]">
          {t("speakerFixed")}
        </p>
      )}
      <div className="divide-y divide-white/10 border-t border-white/10">
        <AudioPreferenceRows />
      </div>
    </div>
  );
}

function VideoSection() {
  const t = useTranslations("Settings.video");
  const tm = useTranslations("Meeting");
  const tp = useTranslations("PreJoin");
  const { camera } = useDevices();
  const { mirrorVideo } = withDefaults(usePreferences());
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-5">
        <div
          role="img"
          aria-label={t("preview")}
          className="relative aspect-video w-[360px] max-w-full flex-none overflow-hidden rounded-xl bg-[#0e1013]"
        >
          {camera.track ? (
            <MirroredVideo track={camera.track} mirror={mirrorVideo} />
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-[#c9d0d8]">
              <VideoOff className="size-6" aria-hidden="true" />
              {tp("cameraOff")}
              {camera.allowed ? (
                <Button
                  variant="secondary"
                  className="h-9 rounded-full px-4"
                  onPress={() => void camera.toggle()}
                >
                  {tm("startVideo")}
                </Button>
              ) : null}
            </span>
          )}
          {camera.track && mirrorVideo ? (
            <span className="absolute top-2.5 right-2.5 rounded-[10px] bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
              {t("mirroredForYou")}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-3">
          <DeviceField
            label={t("camera")}
            devices={camera.devices}
            value={camera.selectedId}
            onChange={(cameraId) => {
              void camera.select(cameraId);
              remember({ cameraId });
            }}
          />
        </div>
      </div>
      <div className="divide-y divide-white/10 border-t border-white/10">
        <VideoPreferenceRows />
      </div>
    </div>
  );
}

/** The same choices as the meeting's panel, applied to the call at once. */
function EffectsSection() {
  const { camera } = useDevices();
  const { mirrorVideo, effect } = withDefaults(usePreferences());
  return (
    <EffectsChooser
      track={camera.track}
      mirror={mirrorVideo}
      cameraOn={camera.enabled}
      value={effect}
      onChange={(next) => setPreference("effect", next)}
      layout="split"
    />
  );
}

function SectionContent({
  section,
  notesInMeetings,
  beforeJoining,
}: {
  section: InCallSection;
  notesInMeetings: boolean | undefined;
  beforeJoining: boolean;
}) {
  switch (section) {
    case "audio":
      return <AudioSection />;
    case "video":
      return <VideoSection />;
    case "general":
      return (
        <div className="flex flex-col gap-5">
          <GeneralSettings
            place={beforeJoining ? "beforeJoining" : "meeting"}
          />
        </div>
      );
    case "reactions":
      return (
        <div className="flex flex-col gap-5">
          <ReactionsSettings />
        </div>
      );
    case "notifications":
      return (
        <div className="flex flex-col gap-5">
          <NotificationsSettings />
        </div>
      );
    case "accessibility":
      return (
        <div className="flex flex-col gap-5">
          <AccessibilitySettings />
        </div>
      );
    case "aiNotes":
      return (
        <div className="flex flex-col gap-5">
          <AiNotesSettings notesInMeetings={notesInMeetings} />
        </div>
      );
    case "effects":
      return <EffectsSection />;
  }
}

type SettingsDialogProps = {
  /** The open section; null when Settings is closed. */
  section: InCallSection | null;
  /**
   * For the meeting's own host: whether their meetings offer AI notes, as this meeting
   * has it. Left out for everyone else, whose own switch doesn't apply here.
   */
  notesInMeetings?: boolean | undefined;
  onSectionChange: (section: InCallSection) => void;
  onClose: () => void;
};

/** Settings during a meeting, for the room's own microphone, speaker and camera. */
export function InCallSettings(props: SettingsDialogProps) {
  const media = useRoomMedia();
  return <SettingsDialog {...props} devices={media} />;
}

/**
 * The meeting's Settings, as in the mockup: sections down the side (across the top on a
 * phone) and the chosen one beside them. Changes apply at once and are kept on this
 * device. The room opens it, and so does the join screen, before the room exists.
 */
export function SettingsDialog({
  section,
  notesInMeetings,
  onSectionChange,
  onClose,
  devices,
  beforeJoining = false,
}: SettingsDialogProps & {
  devices: SettingsDevices;
  /** The join screen's, before you ask to join: General has the language too. */
  beforeJoining?: boolean;
}) {
  const t = useTranslations("Settings");
  const phone = useIsMobile();
  // Only the sections this browser and device can use: backgrounds need the browser's
  // support, and Accessibility is about keyboard shortcuts.
  const keyboard = useCapability("keyboard");
  const effects = useCapability("effects");
  const sections = SECTIONS.filter(
    ({ id }) =>
      (id !== "accessibility" || keyboard) && (id !== "effects" || effects),
  );
  const shown =
    section !== null && sections.some(({ id }) => id === section)
      ? section
      : "audio";

  return (
    <Dialog
      isOpen={section !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      closeLabel={t("close")}
      className="h-[min(820px,calc(100dvh-2rem))] w-[min(1000px,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden bg-[#1c2026] p-0 max-md:h-dvh max-md:w-full max-md:max-w-none max-md:rounded-none sm:max-w-none"
      // A grid item, so it would otherwise widen to fit every tab in a row on a phone.
      bodyClassName="flex size-full min-h-0 min-w-0"
    >
      <DevicesContext value={devices}>
        <SettingsChrome value="dialog">
          <Tabs
            orientation={phone ? "horizontal" : "vertical"}
            selectedKey={shown}
            onSelectionChange={(key) => {
              const next = oneOf(
                sections.map(({ id }) => id),
                key,
              );
              if (next) onSectionChange(next);
            }}
            className="flex size-full min-h-0 max-md:flex-col"
          >
            <div className="flex shrink-0 flex-col bg-[#171a1f] px-3 py-5 max-md:pb-2 md:w-[260px]">
              <DialogTitle className="mx-2.5 text-xl font-bold">
                {t("title")}
              </DialogTitle>
              <span className="text-muted-foreground mx-2.5 mt-1 mb-3.5 text-[13px]">
                {t("forThisDevice")}
              </span>
              <TabList
                aria-label={t("sections")}
                className="flex gap-1 max-md:-mx-3 max-md:overflow-x-auto max-md:px-3 md:flex-col"
              >
                {sections.map(({ id, icon: Icon }) => (
                  <Tab
                    key={id}
                    id={id}
                    className="data-focus-visible:focus-ring flex min-h-[42px] shrink-0 items-center gap-3 rounded-[10px] px-3 text-[15px] whitespace-nowrap text-[#c9d0d8] outline-hidden hover:bg-white/5 data-selected:bg-[#262b33] data-selected:font-semibold data-selected:text-[#f2f4f7] data-selected:shadow-[inset_3px_0_0_var(--color-ring)] max-md:data-selected:shadow-[inset_0_-3px_0_var(--color-ring)]"
                  >
                    <Icon className="size-[18px]" aria-hidden="true" />
                    {t(`section.${id}`)}
                  </Tab>
                ))}
              </TabList>
            </div>
            {sections.map(({ id }) => (
              <TabPanel
                key={id}
                id={id}
                className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-7 pt-5 pb-6 outline-none max-md:px-5"
              >
                <h3 className="pr-10 text-lg font-bold">
                  {t(`section.${id}`)}
                </h3>
                <SectionContent
                  section={id}
                  notesInMeetings={notesInMeetings}
                  beforeJoining={beforeJoining}
                />
              </TabPanel>
            ))}
          </Tabs>
        </SettingsChrome>
      </DevicesContext>
    </Dialog>
  );
}
