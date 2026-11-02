"use client";

import dynamic from "next/dynamic";

import type { UpcomingRow } from "./upcoming-list";

/** Days and times are this device's, so the list renders in the browser. */
const List = dynamic(
  () => import("./upcoming-list").then((module) => module.UpcomingList),
  { ssr: false, loading: () => <div className="min-h-40" aria-busy="true" /> },
);

export function UpcomingLoader({ rows }: { rows: UpcomingRow[] }) {
  return <List rows={rows} />;
}
