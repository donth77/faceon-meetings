import { describe, expect, it } from "vitest";

import {
  addLine,
  MAX_TRANSCRIPT_CHARS,
  transcriptText,
  turnsOf,
  type TranscriptLine,
} from "./transcript";

const line = (
  id: string,
  speakerId: string,
  text: string,
  at = 0,
): TranscriptLine => ({
  id,
  speakerId,
  speaker: speakerId === "a" ? "Ana" : "Ben",
  text,
  at,
  lang: "en-US",
});

describe("addLine", () => {
  it("adds lines in the order they arrive", () => {
    const lines = addLine(
      addLine([], line("1", "a", "Hi")),
      line("2", "b", "Hello"),
    );
    expect(lines.map((l) => l.id)).toEqual(["1", "2"]);
  });

  it("drops a repeat delivery", () => {
    const lines = addLine([], line("1", "a", "Hi"));
    expect(addLine(lines, line("1", "a", "Hi"))).toBe(lines);
  });

  it("stops growing at the limit", () => {
    const long = "x".repeat(MAX_TRANSCRIPT_CHARS - 2);
    const lines = addLine([], line("1", "a", long));
    expect(addLine(lines, line("2", "b", "abc"))).toBe(lines);
    expect(addLine(lines, line("3", "b", "ab"))).toHaveLength(2);
  });
});

describe("turnsOf", () => {
  it("joins a speaker's lines in a row into one turn", () => {
    const turns = turnsOf([
      line("1", "a", "Hi.", 1),
      line("2", "a", "Can you hear me?", 2),
      line("3", "b", "Yes.", 3),
      line("4", "a", "Good.", 4),
    ]);
    expect(turns).toEqual([
      {
        key: "1",
        speakerId: "a",
        speaker: "Ana",
        at: 1,
        text: "Hi. Can you hear me?",
      },
      { key: "3", speakerId: "b", speaker: "Ben", at: 3, text: "Yes." },
      { key: "4", speakerId: "a", speaker: "Ana", at: 4, text: "Good." },
    ]);
  });
});

describe("transcriptText", () => {
  it("writes one paragraph per turn, with who and when", () => {
    const text = transcriptText(
      [line("1", "a", "Hi.", 1), line("2", "b", "Hello.", 2)],
      (at) => `10:0${at}`,
    );
    expect(text).toBe("Ana (10:01): Hi.\n\nBen (10:02): Hello.");
  });
});
