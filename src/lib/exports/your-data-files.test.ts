import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import type { YourData } from "./your-data";
import { yourDataFiles, type YourDataLabels } from "./your-data-files";
import { zipStream } from "./zip";

const labels: YourDataLabels = {
  readme: {
    title: "Your FaceOn data",
    downloaded: "Downloaded today for Maya (maya@example.com).",
    inIt: "What's in it",
    inItItems: ["account.json", "hosting.json"],
    notIn: "What isn't in it",
    notInItems: ["Chat"],
    times: "CSV files use UTC.",
  },
  untitled: (name) => `${name}'s meeting`,
  attendance: {
    name: "Name",
    email: "Email",
    joinedAs: "Joined as",
    host: "Host",
    account: "Account",
    guest: "Guest",
    firstJoined: "First joined (UTC)",
    lastLeft: "Last left (UTC)",
    minutes: "Minutes",
    timesJoined: "Times joined",
  },
  previous: {
    meetingId: "Meeting ID",
    title: "Title",
    host: "Host",
    started: "Started (UTC)",
  },
  meetings: {
    meetingId: "Meeting ID",
    type: "Type",
    title: "Title",
    starts: "Starts (UTC)",
    minutes: "Minutes",
    repeats: "Repeats",
    passcode: "Passcode",
    waitingRoom: "Waiting room",
    guestsAllowed: "Guests allowed",
    invitees: "Invitees",
    cohosts: "Co-hosts",
    yes: "Yes",
    no: "No",
    types: {
      instant: "Instant meeting",
      scheduled: "Scheduled meeting",
      personal: "Personal room",
    },
  },
  notes: {
    summary: "Summary",
    actionItems: "Action items",
    decisions: "Decisions",
    transcript: "Transcript",
    noOwner: "No owner",
    due: (when) => `due ${when}`,
    none: "None",
  },
  when: (start) => start,
};

const settings = {
  waitingRoom: true,
  allowGuests: false,
  joinBeforeHost: false,
  muteOnEntry: false,
  videoOffOnEntry: false,
  allowSelfUnmute: true,
  screenShare: "all",
  chat: true,
  reactions: true,
  autoNotes: false,
  shareNotes: false,
} as const;

const notes = {
  summary: "We agreed on the plan.",
  actionItems: [],
  decisions: ["Ship it"],
};

const data: YourData = {
  generatedAt: "2026-11-02T20:00:00.000Z",
  account: {
    id: "u1",
    name: "Maya",
    email: "maya@example.com",
    emailVerified: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    language: null,
    picture: { source: "dicebear", avatarSeed: "abc-f", photo: null },
    aiNotesInMeetingsYouHost: true,
    scheduleDefaults: null,
    signInMethods: [
      {
        provider: "google",
        connectedAt: "2026-10-01T00:00:00.000Z",
        permissions: [],
      },
    ],
    sessions: [],
  },
  hosting: {
    access: "full",
    approvedInSettings: false,
    approval: null,
    requests: [],
  },
  meetings: [
    {
      meetingId: "1234567890",
      type: "scheduled",
      status: "active",
      madeIn: "faceon",
      title: "Weekly sync",
      description: null,
      passcode: "FF",
      settings,
      startsAt: "2026-11-03T15:00:00.000Z",
      durationMinutes: 30,
      timeZone: "UTC",
      repeats: null,
      changedOccurrences: [],
      invitees: [
        { email: "sam@example.com", cohost: false },
        { email: "lee@example.com", cohost: true },
      ],
      onGoogleCalendar: false,
      createdAt: "2026-11-01T00:00:00.000Z",
    },
  ],
  previous: [
    {
      meetingId: "1234567890",
      title: null,
      hostName: "Maya",
      hostedByYou: true,
      yourRole: "host",
      start: "2026-11-01T15:00:00.000Z",
      end: "2026-11-01T15:30:00.000Z",
      minutes: 30,
      people: [
        {
          name: "Maya",
          email: "maya@example.com",
          joinedAs: "host",
          firstJoined: "2026-11-01T15:00:00.000Z",
          lastLeft: "2026-11-01T15:30:00.000Z",
          minutes: 30,
          visits: [
            {
              joinedAt: "2026-11-01T15:00:00.000Z",
              leftAt: "2026-11-01T15:30:00.000Z",
            },
          ],
        },
        {
          name: "=Guest",
          email: null,
          joinedAs: "guest",
          firstJoined: "2026-11-01T15:05:00.000Z",
          lastLeft: "2026-11-01T15:20:00.000Z",
          minutes: 15,
          visits: [
            {
              joinedAt: "2026-11-01T15:05:00.000Z",
              leftAt: "2026-11-01T15:20:00.000Z",
            },
          ],
        },
      ],
    },
  ],
  notes: [1, 2].map(() => ({
    meetingId: "1234567890",
    title: "Weekly sync",
    hostName: "Maya",
    start: "2026-11-01T15:00:00.000Z",
    end: "2026-11-01T15:30:00.000Z",
    savedByYou: true,
    shared: false,
    madeWith: "onDevice",
    provider: null,
    madeAt: "2026-11-01T15:31:00.000Z",
    savedAt: "2026-11-01T15:32:00.000Z",
    notes,
    transcript: "Maya (15:00): Hello",
  })),
};

async function unzip(stream: ReadableStream<Uint8Array>) {
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  // Keep the CSVs' byte-order mark, which TextDecoder drops by default.
  const text = new TextDecoder("utf-8", { ignoreBOM: true });
  return Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([path, file]) => [
      path,
      text.decode(file),
    ]),
  );
}

describe("Download your data", () => {
  const files = yourDataFiles(data, { labels, timeZone: "UTC" });

  it("has a README, JSON for everything, CSV copies, and each AI note as Markdown", () => {
    expect(files.map((file) => file.path)).toEqual([
      "README.md",
      "account.json",
      "hosting.json",
      "meetings.json",
      "meetings.csv",
      "previous.json",
      "previous.csv",
      "notes.json",
      "notes/2026-11-01 Weekly sync.md",
      "notes/2026-11-01 Weekly sync (2).md",
    ]);
  });

  it("writes the meetings and who came for spreadsheets", () => {
    const meetings = files.find(
      (file) => file.path === "meetings.csv",
    )?.content;
    expect(meetings).toContain(
      "1234567890,Scheduled meeting,Weekly sync,2026-11-03 15:00,30,,FF,Yes,No,sam@example.com,lee@example.com",
    );
    const previous = files.find(
      (file) => file.path === "previous.csv",
    )?.content;
    expect(previous).toContain(
      "1234567890,Maya's meeting,Maya,2026-11-01 15:00,Maya,maya@example.com,Host",
    );
    // A name that looks like a formula stays text.
    expect(previous).toContain(",'=Guest,,Guest,");
  });

  it("keeps the notes' Markdown and the README readable", () => {
    const readme = files.find((file) => file.path === "README.md")?.content;
    expect(readme).toMatch(/^# Your FaceOn data\n/);
    expect(readme).toContain("- Chat");
    const note = files.find((file) => file.path.startsWith("notes/"))?.content;
    expect(note).toContain("# Weekly sync");
    expect(note).toContain("- Ship it");
    expect(note).toContain("Maya (15:00): Hello");
  });

  it("zips them as they're read, and they come back out unchanged", async () => {
    const unzipped = await unzip(zipStream(files));
    expect(Object.keys(unzipped)).toEqual(files.map((file) => file.path));
    for (const file of files) expect(unzipped[file.path]).toBe(file.content);
    expect(JSON.parse(unzipped["account.json"] ?? "{}").email).toBe(
      "maya@example.com",
    );
  });
});
