import { describe, expect, it } from "vitest";

import { MAX_NOTES_LINE, RoomEvent, SharedSessionState } from "./events";

describe("SharedSessionState", () => {
  const stored = {
    v: 1,
    rev: 4,
    locked: false,
    waitingRoom: true,
    chat: true,
    reactions: true,
    screenShare: "all",
    selfUnmute: false,
    host: "u_owner",
    cohosts: ["g_helper"],
    spotlight: "g_helper",
    hands: { u_someone: "2026-11-01T12:00:00.000Z" },
    notes: {
      by: "u_owner",
      name: "Ana",
      startedAt: "2026-11-01T12:05:00.000Z",
    },
    notesAllowed: true,
    notesStopped: false,
    shareNotes: true,
  };

  it("reads the state our server publishes", () => {
    expect(SharedSessionState.parse(stored)).toEqual(stored);
  });

  it("reads a session published before notes could be shared as not sharing them", () => {
    const older: Record<string, unknown> = { ...stored };
    delete older.shareNotes;
    expect(SharedSessionState.parse(older).shareNotes).toBe(false);
  });

  it("reads Stream's null for an empty list", () => {
    const parsed = SharedSessionState.parse({
      ...stored,
      cohosts: null,
      spotlight: null,
      hands: null,
      notes: null,
    });
    expect(parsed.cohosts).toEqual([]);
    expect(parsed.spotlight).toBeNull();
    expect(parsed.hands).toEqual({});
    expect(parsed.notes).toBeNull();
  });

  it("reads sessions that started before roles, the spotlight and AI notes existed", () => {
    const older = SharedSessionState.parse({
      v: 1,
      rev: 0,
      locked: false,
      chat: true,
      reactions: true,
      screenShare: "host",
      hands: {},
    });
    expect(older).toMatchObject({
      waitingRoom: false,
      selfUnmute: true,
      host: "",
      cohosts: [],
      spotlight: null,
      notes: null,
      // Off, as the host's switch for AI notes starts.
      notesAllowed: false,
      notesStopped: false,
    });
  });
});

describe("RoomEvent", () => {
  it("reads transcript lines for AI notes", () => {
    const line = {
      type: "notes.line",
      id: "l1",
      text: " Hello ",
      lang: "en-US",
    };
    expect(RoomEvent.parse(line)).toEqual({ ...line, text: "Hello" });
  });

  it("refuses empty or overlong lines", () => {
    const line = { type: "notes.line", id: "l1", lang: "en-US" };
    expect(RoomEvent.safeParse({ ...line, text: "  " }).success).toBe(false);
    expect(
      RoomEvent.safeParse({ ...line, text: "x".repeat(MAX_NOTES_LINE + 1) })
        .success,
    ).toBe(false);
  });

  it("reads whether someone is in the notes", () => {
    expect(
      RoomEvent.parse({ type: "notes.status", status: "optedOut" }),
    ).toEqual({
      type: "notes.status",
      status: "optedOut",
    });
    expect(
      RoomEvent.safeParse({ type: "notes.status", status: "maybe" }).success,
    ).toBe(false);
  });
});
