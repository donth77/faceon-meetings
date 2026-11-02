import { isGuestMediaId, type PersonVisits } from "@/lib/meetings/attendees";

import type { CsvValue } from "./csv";
import { spreadsheetTime } from "./format";

/** The column headings and the words in an attendance file, in the reader's language. */
export type AttendanceLabels = {
  name: string;
  email: string;
  joinedAs: string;
  host: string;
  account: string;
  guest: string;
  firstJoined: string;
  lastLeft: string;
  minutes: string;
  timesJoined: string;
};

/**
 * Whose email address an attendance file shows. A host already has the addresses they
 * invited, so those appear, with the reader's own; never anyone else's account address,
 * and guests have none.
 */
export function shownEmail(input: {
  mediaUserId: string;
  /** The address of the account they joined with, if any. */
  accountEmail: string | null;
  /** The meeting's invitees, lowercased; empty unless the reader hosts it. */
  invited: ReadonlySet<string>;
  readerMediaId: string;
  readerEmail: string;
}): string | null {
  if (input.mediaUserId === input.readerMediaId) return input.readerEmail;
  if (isGuestMediaId(input.mediaUserId) || !input.accountEmail) return null;
  return input.invited.has(input.accountEmail.toLowerCase())
    ? input.accountEmail
    : null;
}

/** One row per person: the attendance file's rows, headings first. */
export function attendanceRows(input: {
  people: PersonVisits[];
  hostMediaId: string;
  emailOf: (mediaUserId: string) => string | null;
  timeZone: string;
  labels: AttendanceLabels;
}): CsvValue[][] {
  const { labels } = input;
  return [
    [
      labels.name,
      labels.email,
      labels.joinedAs,
      labels.firstJoined,
      labels.lastLeft,
      labels.minutes,
      labels.timesJoined,
    ],
    ...input.people.map((person) => [
      person.name,
      input.emailOf(person.mediaUserId) ?? "",
      person.mediaUserId === input.hostMediaId
        ? labels.host
        : isGuestMediaId(person.mediaUserId)
          ? labels.guest
          : labels.account,
      spreadsheetTime(person.joined, input.timeZone),
      spreadsheetTime(person.left, input.timeZone),
      person.minutes,
      person.visits.length,
    ]),
  ];
}
