"use client";

import dynamic from "next/dynamic";

import type { PastMeeting } from "@/lib/meetings/history";

/** Days and times are this device's, so Previous renders in the browser. */
const View = dynamic(
  () => import("./previous-view").then((module) => module.PreviousView),
  { ssr: false, loading: () => <div className="min-h-40" aria-busy="true" /> },
);

export function PreviousLoader({ meetings }: { meetings: PastMeeting[] }) {
  return <View meetings={meetings} />;
}
