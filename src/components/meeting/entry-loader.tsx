"use client";

import dynamic from "next/dynamic";

import { EntryLoading } from "./entry-loading";
import type { MeetingEntryProps } from "./meeting-entry";

/**
 * Loads the meeting client in the browser only: it needs camera, mic and media APIs, and
 * it keeps the media SDK out of every other page. (`ssr: false` isn't allowed in a
 * Server Component, hence this client wrapper.)
 */
const MeetingEntry = dynamic(() => import("./meeting-entry"), {
  ssr: false,
  loading: () => <EntryLoading />,
});

export function MeetingEntryLoader(props: MeetingEntryProps) {
  return <MeetingEntry {...props} />;
}
