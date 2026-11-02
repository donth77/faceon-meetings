"use client";

import dynamic from "next/dynamic";

import { CardsLoading } from "@/components/app-shell/loading";
import type { PastMeeting } from "@/lib/meetings/history";

/** Days and times are this device's, so Previous renders in the browser. */
const View = dynamic(
  () => import("./previous-view").then((module) => module.PreviousView),
  { ssr: false, loading: () => <CardsLoading /> },
);

export function PreviousLoader({ meetings }: { meetings: PastMeeting[] }) {
  return <View meetings={meetings} />;
}
