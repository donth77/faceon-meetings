import { describe, expect, it } from "vitest";

import {
  addLine,
  BLOCK_MAX_MS,
  BLOCK_PAUSE_MS,
  MAX_TRANSCRIPT_CHARS,
  notesOutdated,
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

  it("starts a new block after a pause, with its own time", () => {
    const pause = BLOCK_PAUSE_MS;
    const turns = turnsOf([
      line("1", "a", "That's all for today.", 0),
      line("2", "a", "One more thing.", pause + 2_000),
      line("3", "a", "The review moves to Thursday.", pause + 5_000),
    ]);
    expect(turns.map((turn) => [turn.at, turn.text])).toEqual([
      [0, "That's all for today."],
      [pause + 2_000, "One more thing. The review moves to Thursday."],
    ]);
  });

  it("keeps a short breath in the same block", () => {
    expect(
      turnsOf([
        line("1", "a", "Hi.", 0),
        line("2", "a", "Sorry, go on.", BLOCK_PAUSE_MS - 1),
      ]),
    ).toHaveLength(1);
  });

  it("splits a long stretch of talk by time", () => {
    const every = 10_000;
    const lines = Array.from({ length: 9 }, (_, i) =>
      line(String(i), "a", "A few words here.", i * every),
    );
    const turns = turnsOf(lines);
    expect(turns.map((turn) => turn.at)).toEqual([0, BLOCK_MAX_MS]);
  });

  it("splits a long stretch of talk by words", () => {
    const sentence = Array.from({ length: 50 }, () => "word").join(" ");
    const turns = turnsOf([
      line("1", "a", sentence, 0),
      line("2", "a", sentence, 1_000),
      line("3", "a", sentence, 2_000),
    ]);
    // Two lines fit (100 words); the third would pass BLOCK_MAX_WORDS.
    expect(turns.map((turn) => turn.key)).toEqual(["1", "3"]);
  });
});

describe("transcriptText", () => {
  it("writes one paragraph per block, with who and when", () => {
    const text = transcriptText(
      [line("1", "a", "Hi.", 1), line("2", "b", "Hello.", 2)],
      (at) => `10:0${at}`,
    );
    expect(text).toBe("Ana (10:01): Hi.\n\nBen (10:02): Hello.");
  });
});

describe("transcriptText after a pause", () => {
  it("gives the same speaker a new paragraph after a pause", () => {
    const text = transcriptText(
      [line("1", "a", "Bye.", 0), line("2", "a", "Wait!", BLOCK_PAUSE_MS)],
      (at) => (at === 0 ? "10:00" : "10:01"),
    );
    expect(text).toBe("Ana (10:00): Bye.\n\nAna (10:01): Wait!");
  });
});

describe("notesOutdated", () => {
  const made = {
    notes: { summary: "", actionItems: [], decisions: [] },
    engine: "onDevice" as const,
    madeAt: 100,
  };

  it("holds notes made after every line", () => {
    expect(notesOutdated(made, [line("1", "a", "Hi.", 50)])).toBe(false);
  });

  it("calls notes out of date once a line comes after them", () => {
    expect(
      notesOutdated(made, [
        line("1", "a", "Hi.", 50),
        line("2", "b", "More.", 150),
      ]),
    ).toBe(true);
  });
});
