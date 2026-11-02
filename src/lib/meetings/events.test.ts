import { describe, expect, it } from "vitest";

import { SharedSessionState } from "./events";

describe("SharedSessionState", () => {
  const stored = {
    v: 1,
    rev: 4,
    locked: false,
    chat: true,
    reactions: true,
    screenShare: "all",
    selfUnmute: false,
    host: "u_owner",
    cohosts: ["g_helper"],
    spotlight: "g_helper",
    hands: { u_someone: "2026-11-01T12:00:00.000Z" },
  };

  it("reads the state our server publishes", () => {
    expect(SharedSessionState.parse(stored)).toEqual(stored);
  });

  it("reads Stream's null for an empty list", () => {
    const parsed = SharedSessionState.parse({
      ...stored,
      cohosts: null,
      spotlight: null,
      hands: null,
    });
    expect(parsed.cohosts).toEqual([]);
    expect(parsed.spotlight).toBeNull();
    expect(parsed.hands).toEqual({});
  });

  it("reads sessions that started before roles and the spotlight existed", () => {
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
      selfUnmute: true,
      host: "",
      cohosts: [],
      spotlight: null,
    });
  });
});
