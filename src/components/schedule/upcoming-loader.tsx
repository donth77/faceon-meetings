"use client";

import dynamic from "next/dynamic";

import type { UpcomingRow } from "./upcoming-list";

/** Days and times are this device's, so Upcoming renders in the browser. */
const View = dynamic(
  () => import("./upcoming-view").then((module) => module.UpcomingView),
  { ssr: false, loading: () => <div className="min-h-40" aria-busy="true" /> },
);

export function UpcomingLoader({ rows }: { rows: UpcomingRow[] }) {
  return <View rows={rows} />;
}
