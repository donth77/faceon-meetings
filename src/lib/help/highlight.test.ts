import { describe, expect, it } from "vitest";

import { findMatches, type Match } from "./highlight";

/** The text each match covers, joined across its pieces. */
const texts = (runs: string[][], matches: Match[]) =>
  matches.map((match) =>
    match
      .map(
        (piece) =>
          runs[piece.run]?.[piece.segment]?.slice(piece.start, piece.end) ?? "",
      )
      .join(""),
  );

describe("findMatches", () => {
  it("finds the whole phrase, case set aside", () => {
    const runs = [["Turn on Push to talk in Settings."]];
    const found = findMatches(runs, "push to talk");
    expect(found.mode).toBe("phrase");
    expect(texts(runs, found.matches)).toEqual(["Push to talk"]);
  });

  it("follows a phrase across an element, in one piece per text", () => {
    // "Hold **Space** to talk": the bold splits the run into three segments.
    const runs = [["Hold ", "Space", " to talk, then let go."]];
    const found = findMatches(runs, "space to talk");
    expect(found.matches).toEqual([
      [
        { run: 0, segment: 1, start: 0, end: 5 },
        { run: 0, segment: 2, start: 0, end: 8 },
      ],
    ]);
  });

  it("matches a phrase whatever separates its words", () => {
    const runs = [["Turn on push-to-talk, or push  to talk."]];
    expect(texts(runs, findMatches(runs, "push to talk").matches)).toEqual([
      "push-to-talk",
      "push  to talk",
    ]);
  });

  it("sets accents aside, and maps back to the original text", () => {
    const runs = [["Partager l’écran, puis l'Ecran."]];
    const found = findMatches(runs, "ÉCRAN");
    expect(texts(runs, found.matches)).toEqual(["écran", "Ecran"]);
  });

  it("prefers the phrase: its words alone elsewhere aren't marked", () => {
    const runs = [["Push to talk is off."], ["Talk to the host."]];
    const found = findMatches(runs, "push to talk");
    expect(found.mode).toBe("phrase");
    expect(found.matches).toHaveLength(1);
  });

  it("falls back to the words that mean something, without the joining ones", () => {
    const runs = [["Hold the key to talk."], ["Push it again."]];
    const found = findMatches(runs, "how to push and talk");
    expect(found.mode).toBe("words");
    expect(texts(runs, found.matches)).toEqual(["talk", "Push"]);
  });

  it("never joins two runs into one match", () => {
    const runs = [["Turn on push to"], ["talk in Settings."]];
    const found = findMatches(runs, "push to talk");
    expect(found.mode).toBe("words");
    expect(texts(runs, found.matches)).toEqual(["push", "talk"]);
  });

  it("starts matches at the start of a word", () => {
    const runs = [["Unmute, then mute again. Muted?"]];
    expect(texts(runs, findMatches(runs, "mute").matches)).toEqual([
      "mute",
      "Mute",
    ]);
  });

  it("doesn't overlap: the longer word wins where two start together", () => {
    const runs = [["Your notes and a note."]];
    const found = findMatches(runs, "note notes");
    expect(found.mode).toBe("words");
    expect(texts(runs, found.matches)).toEqual(["notes", "note"]);
  });

  it("finds words in scripts written without spaces", () => {
    const runs = [["画面共有を開始します。"]];
    expect(texts(runs, findMatches(runs, "画面共有").matches)).toEqual([
      "画面共有",
    ]);
  });

  it("finds nothing for an empty search, or one of joining words only", () => {
    const runs = [["Push to talk."]];
    expect(findMatches(runs, "  ").matches).toEqual([]);
    expect(findMatches(runs, "to the").matches).toEqual([]);
  });

  it("treats the query as text, not a pattern", () => {
    const runs = [["Press (M) to mute, or C++."]];
    expect(texts(runs, findMatches(runs, "(M)").matches)).toEqual(["M"]);
    expect(findMatches(runs, ".*").matches).toEqual([]);
  });
});
