"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect, useState } from "react";

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

/**
 * Next.js keeps pages you've left alive but hidden (React's Activity), and shows them as
 * they were when you come back. A meeting you left, or ended, would greet you with "You
 * left the meeting" instead of letting you join again, so the meeting starts over each
 * time its page is hidden: back on it, by a link or Back, you're at pre-join.
 */
export function MeetingEntryLoader(props: MeetingEntryProps) {
  const [visit, setVisit] = useState(0);
  // A layout effect's cleanup runs as the page is hidden, before it's shown again.
  useLayoutEffect(() => () => setVisit((count) => count + 1), []);
  return <MeetingEntry key={visit} {...props} />;
}
