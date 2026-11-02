"use client";

import dynamic from "next/dynamic";

import { PanelLoading } from "@/components/app-shell/loading";
import type { MeetingDetails } from "@/lib/meetings/scheduling";

/** Times are formatted for this browser, so the page renders there, as Upcoming does. */
const View = dynamic(
  () => import("./meeting-details").then((module) => module.MeetingDetailsView),
  { ssr: false, loading: () => <PanelLoading height="h-96" /> },
);

export function MeetingDetailsLoader({ details }: { details: MeetingDetails }) {
  return <View details={details} />;
}
