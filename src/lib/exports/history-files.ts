import type { NotesLabels } from "@/lib/notes/notes";

import type { AttendanceLabels } from "./attendance";
import { toCsv, type CsvValue } from "./csv";
import {
  attendanceTable,
  noteFiles,
  readmeFile,
  type ExportFile,
  type MeetingColumnLabels,
  type ReadmeLabels,
} from "./files";
import { spreadsheetTime } from "./format";
import type { HistoryData, PreviousEntry } from "./history-data";

/** The words "Download history" is written with, in the reader's language. */
export type HistoryLabels = {
  readme: ReadmeLabels;
  /** "{name}'s meeting", for a meeting without a title. */
  untitled: (hostName: string) => string;
  history: {
    meetingId: string;
    started: string;
    title: string;
    host: string;
    yourRole: string;
    minutes: string;
    people: string;
    roles: Record<PreviousEntry["yourRole"], string>;
  };
  meeting: MeetingColumnLabels;
  attendance: AttendanceLabels;
  notes: NotesLabels;
  /** When a meeting was, written out, for its notes' heading. */
  when: (start: string, end: string) => string;
};

/**
 * Previous's "Download history", like Google Takeout's Meet history: a README, one row
 * per meeting (history.csv), who came to the meetings you hosted (attendance.csv, on the
 * export's email rule), and the AI notes you can read with their transcripts. Times in
 * `timeZone`. Pure, so its contents are tested without a database.
 */
export function historyFiles(
  data: HistoryData,
  { labels, timeZone }: { labels: HistoryLabels; timeZone: string },
): ExportFile[] {
  const { history } = labels;
  return [
    readmeFile(labels.readme),
    {
      path: "history.csv",
      content: toCsv([
        [
          history.meetingId,
          history.started,
          history.title,
          history.host,
          history.yourRole,
          history.minutes,
          history.people,
        ],
        ...data.previous.map((past): CsvValue[] => [
          past.meetingId,
          spreadsheetTime(past.start, timeZone),
          past.title ?? labels.untitled(past.hostName),
          past.hostName,
          history.roles[past.yourRole],
          past.minutes,
          past.people.length,
        ]),
      ]),
    },
    {
      path: "attendance.csv",
      content: toCsv(
        attendanceTable(
          data.previous.filter((past) => past.hostedByYou),
          {
            meeting: labels.meeting,
            attendance: labels.attendance,
            untitled: labels.untitled,
            timeZone,
          },
        ),
      ),
    },
    ...noteFiles(data.notes, {
      labels: labels.notes,
      when: labels.when,
      untitled: labels.untitled,
      timeZone,
    }),
  ];
}
