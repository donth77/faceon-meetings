"use client";

import dynamic from "next/dynamic";

import { CardsLoading } from "@/components/app-shell/loading";

import type { UpcomingRow } from "./upcoming-list";

/** Days and times are this device's, so Upcoming renders in the browser. */
const View = dynamic(
  () => import("./upcoming-view").then((module) => module.UpcomingView),
  { ssr: false, loading: () => <CardsLoading /> },
);

export function UpcomingLoader({ rows }: { rows: UpcomingRow[] }) {
  return <View rows={rows} />;
}
