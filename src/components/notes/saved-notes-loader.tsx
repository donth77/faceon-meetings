"use client";

import dynamic from "next/dynamic";

import { PanelLoading } from "@/components/app-shell/loading";
import type { SavedNotes } from "@/lib/meetings/saved-notes";

/** Times are this device's, so the page renders in the browser, as Previous does. */
const View = dynamic(
  () => import("./saved-notes-view").then((module) => module.SavedNotesView),
  { ssr: false, loading: () => <PanelLoading height="h-96" /> },
);

export function SavedNotesLoader({ notes }: { notes: SavedNotes }) {
  return <View notes={notes} />;
}
