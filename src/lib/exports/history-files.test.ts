import { describe, expect, it } from "vitest";

import type { HistoryData } from "./history-data";
import { historyFiles, type HistoryLabels } from "./history-files";

const labels: HistoryLabels = {
  readme: {
    title: "Your FaceOn meeting history",
    downloaded: "Downloaded today for Maya.",
    inIt: "What's in it",
    inItItems: ["history.csv", "attendance.csv", "notes"],
    notIn: "What isn't in it",
    notInItems: ["Chat"],
    times: "Times are in UTC.",
  },
  untitled: (name) => `${name}'s meeting`,
  history: {
    meetingId: "Meeting ID",
    started: "Started (UTC)",
    title: "Title",
    host: "Host",
    yourRole: "Your role",
    minutes: "Minutes",
    people: "People",
    roles: { host: "Host", cohost: "Co-host", participant: "Participant" },
  },
  meeting: {
    meetingId: "Meeting ID",
    title: "Title",
    host: "Host",
    started: "Started (UTC)",
  },
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

const person = (
  name: string,
  joinedAs: "host" | "account" | "guest",
  email: string | null,
) => ({
  name,
  email,
  joinedAs,
  firstJoined: "2026-11-01T15:00:00.000Z",
  lastLeft: "2026-11-01T15:30:00.000Z",
  minutes: 30,
  visits: [
    {
      joinedAt: "2026-11-01T15:00:00.000Z",
      leftAt: "2026-11-01T15:30:00.000Z",
    },
  ],
});

const data: HistoryData = {
  previous: [
    {
      meetingId: "1111111111",
      title: "Weekly sync",
      hostName: "Maya",
      hostedByYou: true,
      yourRole: "host",
      start: "2026-11-01T15:00:00.000Z",
      end: "2026-11-01T15:30:00.000Z",
      minutes: 30,
      people: [
        person("Maya", "host", "maya@example.com"),
        person("Sam", "account", "sam@example.com"),
      ],
    },
    {
      meetingId: "2222222222",
      title: null,
      hostName: "Lee",
      hostedByYou: false,
      yourRole: "cohost",
      start: "2026-10-30T09:00:00.000Z",
      end: "2026-10-30T10:15:00.000Z",
      minutes: 75,
      people: [person("Lee", "host", null), person("Maya", "account", null)],
    },
  ],
  notes: [
    {
      meetingId: "1111111111",
      title: "Weekly sync",
      hostName: "Maya",
      start: "2026-11-01T15:00:00.000Z",
      end: "2026-11-01T15:30:00.000Z",
      savedByYou: true,
      shared: true,
      madeWith: "onDevice",
      provider: null,
      madeAt: "2026-11-01T15:31:00.000Z",
      savedAt: "2026-11-01T15:32:00.000Z",
      notes: { summary: "Plans agreed.", actionItems: [], decisions: [] },
      transcript: "Maya (15:00): Shall we start?\n\nSam (15:01): Yes.",
    },
  ],
};

describe("Download history", () => {
  const files = historyFiles(data, { labels, timeZone: "UTC" });
  const file = (path: string) =>
    files.find((entry) => entry.path === path)?.content ?? "";

  it("has a README, the meetings, the attendance and the notes", () => {
    expect(files.map((entry) => entry.path)).toEqual([
      "README.md",
      "history.csv",
      "attendance.csv",
      "notes/2026-11-01 Weekly sync.md",
    ]);
    expect(file("README.md")).toMatch(/^# Your FaceOn meeting history\n/);
  });

  it("lists every meeting once, with your role, how long it lasted and who came", () => {
    // trim() would take the byte-order mark too: only the last line end goes.
    const rows = file("history.csv").replace(/\r\n$/, "").split("\r\n");
    expect(rows).toEqual([
      "﻿Meeting ID,Started (UTC),Title,Host,Your role,Minutes,People",
      "1111111111,2026-11-01 15:00,Weekly sync,Maya,Host,30,2",
      "2222222222,2026-10-30 09:00,Lee's meeting,Lee,Co-host,75,2",
    ]);
  });

  it("has attendance only for the meetings you hosted", () => {
    const attendance = file("attendance.csv");
    expect(attendance).toContain("1111111111,Weekly sync,Maya,");
    expect(attendance).toContain(",Sam,sam@example.com,Account,");
    expect(attendance).not.toContain("2222222222");
  });

  it("keeps each note's transcript in its Markdown", () => {
    const note = file("notes/2026-11-01 Weekly sync.md");
    expect(note).toContain("Plans agreed.");
    expect(note).toContain("## Transcript");
    expect(note).toContain("Sam (15:01): Yes.");
  });
});
