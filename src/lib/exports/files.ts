import { notesMarkdown, type NotesLabels } from "@/lib/notes/notes";

import type { AttendanceLabels } from "./attendance";
import type { CsvValue } from "./csv";
import { fileName, spreadsheetDay, spreadsheetTime } from "./format";
import type { NoteEntry, PreviousEntry } from "./history-data";

/** A file in an export: its path inside the zip, and its text. */
export type ExportFile = { path: string; content: string };

/** What a README says: what's in the export, what isn't and why, and its times. */
export type ReadmeLabels = {
  title: string;
  downloaded: string;
  inIt: string;
  inItItems: string[];
  notIn: string;
  notInItems: string[];
  times: string;
};

/** The headings a meeting's columns start with, in attendance tables. */
export type MeetingColumnLabels = {
  meetingId: string;
  title: string;
  host: string;
  started: string;
};

export const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export function readmeFile(readme: ReadmeLabels): ExportFile {
  return {
    path: "README.md",
    content: `${[
      `# ${readme.title}`,
      readme.downloaded,
      `## ${readme.inIt}`,
      readme.inItItems.map((item) => `- ${item}`).join("\n"),
      `## ${readme.notIn}`,
      readme.notInItems.map((item) => `- ${item}`).join("\n"),
      readme.times,
    ].join("\n\n")}\n`,
  };
}

/** Who came to these meetings: one row per person per meeting, headings first. */
export function attendanceTable(
  previous: PreviousEntry[],
  input: {
    meeting: MeetingColumnLabels;
    attendance: AttendanceLabels;
    untitled: (hostName: string) => string;
    timeZone: string;
  },
): CsvValue[][] {
  const { meeting, attendance, timeZone } = input;
  return [
    [
      meeting.meetingId,
      meeting.title,
      meeting.host,
      meeting.started,
      attendance.name,
      attendance.email,
      attendance.joinedAs,
      attendance.firstJoined,
      attendance.lastLeft,
      attendance.minutes,
      attendance.timesJoined,
    ],
    ...previous.flatMap((past) =>
      past.people.map((person): CsvValue[] => [
        past.meetingId,
        past.title ?? input.untitled(past.hostName),
        past.hostName,
        spreadsheetTime(past.start, timeZone),
        person.name,
        person.email,
        attendance[person.joinedAs],
        spreadsheetTime(person.firstJoined, timeZone),
        spreadsheetTime(person.lastLeft, timeZone),
        person.minutes,
        person.visits.length,
      ]),
    ),
  ];
}

/**
 * Each AI note as Markdown, with its transcript where it was saved, in a `notes` folder:
 * named by its day and meeting, never twice the same.
 */
export function noteFiles(
  notes: NoteEntry[],
  input: {
    labels: NotesLabels;
    when: (start: string, end: string) => string;
    untitled: (hostName: string) => string;
    timeZone: string;
  },
): ExportFile[] {
  const taken = new Set<string>();
  return notes.map((saved) => {
    const title = saved.title ?? input.untitled(saved.hostName);
    const base = fileName(
      `${spreadsheetDay(saved.start, input.timeZone)} ${title}`,
    );
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} (${n})`;
    taken.add(name.toLowerCase());
    return {
      path: `notes/${name}.md`,
      content: notesMarkdown({
        title,
        when: input.when(saved.start, saved.end),
        notes: saved.notes,
        transcript: saved.transcript ?? "",
        labels: input.labels,
      }),
    };
  });
}
