"use client";

import dynamic from "next/dynamic";

import { PanelLoading } from "@/components/app-shell/loading";

import type { EmailRemindersSetting } from "./notifications-settings";

const loading = () => <PanelLoading height="h-72" />;

// These sections read this device's settings, devices and clock, so they render in the browser.
const General = dynamic(
  () => import("./general-settings").then((module) => module.GeneralSettings),
  { ssr: false, loading },
);
const Audio = dynamic(
  () => import("./audio-settings").then((module) => module.AudioSettings),
  { ssr: false, loading },
);
const Video = dynamic(
  () => import("./video-settings").then((module) => module.VideoSettings),
  { ssr: false, loading },
);
const Reactions = dynamic(
  () =>
    import("./reactions-settings").then((module) => module.ReactionsSettings),
  { ssr: false, loading },
);
const Notifications = dynamic(
  () =>
    import("./notifications-settings").then(
      (module) => module.NotificationsSettings,
    ),
  { ssr: false, loading },
);
const Effects = dynamic(
  () => import("./effects-settings").then((module) => module.EffectsSettings),
  { ssr: false, loading },
);
const AiNotes = dynamic(
  () => import("./ai-notes-settings").then((module) => module.AiNotesSettings),
  { ssr: false, loading },
);
const Desktop = dynamic(
  () => import("./desktop-settings").then((module) => module.DesktopSettings),
  { ssr: false, loading },
);
const Accessibility = dynamic(
  () =>
    import("./accessibility-settings").then(
      (module) => module.AccessibilitySettings,
    ),
  { ssr: false, loading },
);

export function SettingsLoader({
  section,
  notesInMeetings,
  emailReminders,
}: {
  section:
    | "general"
    | "audio"
    | "video"
    | "reactions"
    | "notifications"
    | "effects"
    | "aiNotes"
    | "accessibility"
    | "desktop";
  /** Settings → AI notes: the account's switch for meetings you host. */
  notesInMeetings?: boolean;
  /** Settings → Notifications: the account's email reminders (not in a meeting). */
  emailReminders?: EmailRemindersSetting;
}) {
  switch (section) {
    case "general":
      return <General />;
    case "audio":
      return <Audio />;
    case "video":
      return <Video />;
    case "reactions":
      return <Reactions />;
    case "notifications":
      return <Notifications emailReminders={emailReminders} />;
    case "effects":
      return <Effects />;
    case "aiNotes":
      return <AiNotes notesInMeetings={notesInMeetings} />;
    case "accessibility":
      return <Accessibility />;
    case "desktop":
      return <Desktop />;
  }
}
