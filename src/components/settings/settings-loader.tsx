"use client";

import dynamic from "next/dynamic";

const loading = () => <div className="min-h-60" aria-busy="true" />;

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
const Accessibility = dynamic(
  () =>
    import("./accessibility-settings").then(
      (module) => module.AccessibilitySettings,
    ),
  { ssr: false, loading },
);

export function SettingsLoader({
  section,
}: {
  section: "general" | "audio" | "video" | "accessibility";
}) {
  switch (section) {
    case "general":
      return <General />;
    case "audio":
      return <Audio />;
    case "video":
      return <Video />;
    case "accessibility":
      return <Accessibility />;
  }
}
