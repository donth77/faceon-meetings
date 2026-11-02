"use client";

import dynamic from "next/dynamic";

import type { MeetingDetails } from "@/lib/meetings/scheduling";

/** Times are formatted for this browser, so the page renders there, as Upcoming does. */
const View = dynamic(
  () => import("./meeting-details").then((module) => module.MeetingDetailsView),
  { ssr: false, loading: () => <div className="min-h-96" aria-busy="true" /> },
);

export function MeetingDetailsLoader({ details }: { details: MeetingDetails }) {
  return <View details={details} />;
}
