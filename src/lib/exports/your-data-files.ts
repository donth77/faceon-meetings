import { notesMarkdown, type NotesLabels } from "@/lib/notes/notes";

import type { AttendanceLabels } from "./attendance";
import { toCsv, type CsvValue } from "./csv";
import { fileName, spreadsheetDay, spreadsheetTime } from "./format";
import type { YourData } from "./your-data";

/** The words the export is written with, in the reader's language, values filled in. */
export type YourDataLabels = {
  readme: {
    title: string;
    downloaded: string;
    inIt: string;
    inItItems: string[];
    notIn: string;
    notInItems: string[];
    times: string;
  };
  /** "{name}'s meeting", for a meeting without a title. */
  untitled: (hostName: string) => string;
  attendance: AttendanceLabels;
  previous: { meetingId: string; title: string; host: string; started: string };
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

/** A file in the export: its path inside the zip, and its text. */
export type ExportFile = { path: string; content: string };

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/**
 * "Download your data" as files: a README saying what's in it and what isn't, JSON with
 * everything, CSV copies for spreadsheets (times in `timeZone`), and each AI note as
 * Markdown. Pure, so its contents are tested without a database.
 */
export function yourDataFiles(
  data: YourData,
  { labels, timeZone }: { labels: YourDataLabels; timeZone: string },
): ExportFile[] {
  const titleOf = (title: string | null, hostName: string) =>
    title ?? labels.untitled(hostName);
  const yesNo = (value: boolean) =>
    value ? labels.meetings.yes : labels.meetings.no;
  const { readme } = labels;

  const files: ExportFile[] = [
    {
      path: "README.md",
      content:
        [
          `# ${readme.title}`,
          readme.downloaded,
          `## ${readme.inIt}`,
          readme.inItItems.map((item) => `- ${item}`).join("\n"),
          `## ${readme.notIn}`,
          readme.notInItems.map((item) => `- ${item}`).join("\n"),
          readme.times,
        ].join("\n\n") + "\n",
    },
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
      content: toCsv([
        [
          labels.previous.meetingId,
          labels.previous.title,
          labels.previous.host,
          labels.previous.started,
          labels.attendance.name,
          labels.attendance.email,
          labels.attendance.joinedAs,
          labels.attendance.firstJoined,
          labels.attendance.lastLeft,
          labels.attendance.minutes,
          labels.attendance.timesJoined,
        ],
        ...data.previous.flatMap((past) =>
          past.people.map((person): CsvValue[] => [
            past.meetingId,
            titleOf(past.title, past.hostName),
            past.hostName,
            spreadsheetTime(past.start, timeZone),
            person.name,
            person.email,
            labels.attendance[person.joinedAs],
            spreadsheetTime(person.firstJoined, timeZone),
            spreadsheetTime(person.lastLeft, timeZone),
            person.minutes,
            person.visits.length,
          ]),
        ),
      ]),
    },
    { path: "notes.json", content: json(data.notes) },
  ];

  // Each AI note as Markdown, named by its day and meeting, never twice the same.
  const taken = new Set<string>();
  for (const saved of data.notes) {
    const title = titleOf(saved.title, saved.hostName);
    const base = fileName(`${spreadsheetDay(saved.start, timeZone)} ${title}`);
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} (${n})`;
    taken.add(name.toLowerCase());
    files.push({
      path: `notes/${name}.md`,
      content: notesMarkdown({
        title,
        when: labels.when(saved.start, saved.end),
        notes: saved.notes,
        transcript: saved.transcript ?? "",
        labels: labels.notes,
      }),
    });
  }
  return files;
}
