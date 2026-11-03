import type { NotesLabels } from "@/lib/notes/notes";

import type { AttendanceLabels } from "./attendance";
import { toCsv, type CsvValue } from "./csv";
import {
  attendanceTable,
  json,
  noteFiles,
  readmeFile,
  type ExportFile,
  type MeetingColumnLabels,
  type ReadmeLabels,
} from "./files";
import { spreadsheetTime } from "./format";
import type { YourData } from "./your-data";

export type { ExportFile } from "./files";

/** The words the export is written with, in the reader's language, values filled in. */
export type YourDataLabels = {
  readme: ReadmeLabels;
  /** "{name}'s meeting", for a meeting without a title. */
  untitled: (hostName: string) => string;
  attendance: AttendanceLabels;
  previous: MeetingColumnLabels;
  meetings: {
    meetingId: string;
    type: string;
    title: string;
    starts: string;
    minutes: string;
    repeats: string;
    passcode: string;
    waitingRoom: string;
    guestsAllowed: string;
    invitees: string;
    cohosts: string;
    yes: string;
    no: string;
    types: Record<YourData["meetings"][number]["type"], string>;
  };
  notes: NotesLabels;
  /** When a meeting was, written out, for its notes' heading. */
  when: (start: string, end: string) => string;
};

/**
 * "Download your data" as files: a README saying what's in it and what isn't, JSON with
 * everything, CSV copies for spreadsheets (times in `timeZone`), and each AI note as
 * Markdown with its transcript. Pure, so its contents are tested without a database.
 */
export function yourDataFiles(
  data: YourData,
  { labels, timeZone }: { labels: YourDataLabels; timeZone: string },
): ExportFile[] {
  const yesNo = (value: boolean) =>
    value ? labels.meetings.yes : labels.meetings.no;

  return [
    readmeFile(labels.readme),
    { path: "account.json", content: json(data.account) },
    { path: "hosting.json", content: json(data.hosting) },
    { path: "meetings.json", content: json(data.meetings) },
    {
      path: "meetings.csv",
      content: toCsv([
        [
          labels.meetings.meetingId,
          labels.meetings.type,
          labels.meetings.title,
          labels.meetings.starts,
          labels.meetings.minutes,
          labels.meetings.repeats,
          labels.meetings.passcode,
          labels.meetings.waitingRoom,
          labels.meetings.guestsAllowed,
          labels.meetings.invitees,
          labels.meetings.cohosts,
        ],
        ...data.meetings.map((row): CsvValue[] => {
          const starts = row.repeats?.firstStart ?? row.startsAt;
          return [
            row.meetingId,
            labels.meetings.types[row.type],
            row.title,
            starts ? spreadsheetTime(starts, timeZone) : "",
            row.repeats?.durationMinutes ?? row.durationMinutes,
            row.repeats?.rule,
            row.passcode,
            yesNo(row.settings.waitingRoom),
            yesNo(row.settings.allowGuests),
            row.invitees
              .filter((invitee) => !invitee.cohost)
              .map((invitee) => invitee.email)
              .join("; "),
            row.invitees
              .filter((invitee) => invitee.cohost)
              .map((invitee) => invitee.email)
              .join("; "),
          ];
        }),
      ]),
    },
    { path: "previous.json", content: json(data.previous) },
    {
      path: "previous.csv",
      content: toCsv(
        attendanceTable(data.previous, {
          meeting: labels.previous,
          attendance: labels.attendance,
          untitled: labels.untitled,
          timeZone,
        }),
      ),
    },
    { path: "notes.json", content: json(data.notes) },
    ...noteFiles(data.notes, {
      labels: labels.notes,
      when: labels.when,
      untitled: labels.untitled,
      timeZone,
    }),
  ];
}
