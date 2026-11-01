import { LoaderCircle } from "lucide-react";

import { MeetingPageFrame } from "./page-frame";

/** Shown while the meeting page loads. */
export function EntryLoading() {
  return (
    <MeetingPageFrame>
      <LoaderCircle
        className="text-muted-foreground size-8 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
    </MeetingPageFrame>
  );
}
