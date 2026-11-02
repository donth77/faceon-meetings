/**
 * The Google Workspace add-on's API (/api/addon/google/*): what the add-on sends and
 * gets back. Types only, with no imports, so the add-on (google-addon/) can share them;
 * the server checks every request against the schemas in api.ts.
 */

/** A meeting made from Google Calendar keeps its event: an opaque ID and its calendar. */
export type GoogleAddonEvent = { eventId: string; calendarId: string };

/** A Calendar event's title, time and repeat, as the add-on reads them. */
export type EventTiming = {
  title?: string;
  /** ISO 8601 instants. An all-day event's are its first and last midnights, in UTC. */
  start: string;
  end: string;
  /** The event's IANA time zone (the calendar's when the event has none). */
  timeZone?: string;
  allDay?: boolean;
  /** Its RRULE (and EXDATE, RDATE) lines, as Calendar keeps them. */
  recurrence?: string[];
};

/** POST /conferences: "FaceOn meeting" chosen for an event. */
export type ConferenceCreate = {
  eventId: string;
  calendarId: string;
  locale?: string;
  /** Missing while a new event isn't saved yet: the meeting gets its time when it is. */
  event?: EventTiming;
};

/** PATCH /conferences/{code}: the event changed, or one meeting of its series did. */
export type ConferenceUpdate =
  | { event: EventTiming }
  | {
      occurrence: {
        /** The meeting's planned start in the series. */
        originalStart: string;
        start?: string;
        end?: string;
        cancelled?: boolean;
      };
    };

/** POST /meetings: for Gmail's compose window, or the sidebar's Start a meeting. */
export type MeetingCreate = {
  kind: "new" | "personalRoom";
  title?: string;
  locale?: string;
};

/** What Calendar's conference details need. */
export type AddonConference = {
  code: string;
  /** "123 456 7890". */
  meetingId: string;
  /** The join link, with the passcode in its fragment. */
  joinUrl: string;
  passcode: string | null;
};

/** A meeting to join or send: its details and an invitation in the person's language. */
export type AddonMeeting = AddonConference & {
  title: string;
  invitation: string;
};

/** GET /home: the sidebar. */
export type AddonHome = {
  name: string;
  personalRoom: AddonMeeting;
  /** The next week's meetings, with "when" already in the person's language and zone. */
  upcoming: { code: string; title: string; when: string; joinUrl: string }[];
};

export type AddonErrorCode =
  /** This copy of FaceOn doesn't serve the add-on (GOOGLE_ADDON_CLIENT_ID is unset). */
  | "NOT_AVAILABLE"
  /** The identity token didn't pass: not Google's, not for this add-on, or expired. */
  | "INVALID_TOKEN"
  /** No FaceOn account knows this Google account: `link` signs in. */
  | "AUTHENTICATION"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "NOT_FOUND"
  /** It can't be done: `reason` says why, `link` explains. */
  | "PERMANENT"
  /** FaceOn can't do it right now; try again. */
  | "TEMPORARY";

export type AddonErrorBody = {
  error: { code: AddonErrorCode; reason?: "dailyLimit"; link?: string };
};
