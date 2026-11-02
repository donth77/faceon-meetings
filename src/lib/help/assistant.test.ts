import { describe, expect, it } from "vitest";

import { nearest, promptFor, relevant, wordsOf, type Doc } from "./assistant";

const doc = (
  slug: string,
  title: string,
  keywords: string,
  text: string,
): Doc => ({
  slug,
  title,
  keywords,
  text,
});

const DOCS = [
  doc(
    "start-a-meeting",
    "Start a meeting",
    "Start one now",
    "On Home, select New meeting.",
  ),
  doc(
    "join-a-meeting",
    "Join a meeting",
    "Open the link",
    "Enter the meeting ID.",
  ),
  doc("invite-people", "Invite people", "Share the link", "Copy invitation."),
  doc(
    "share-your-screen",
    "Share your screen",
    "Share a tab, a window or your whole screen, with sound",
    "Select Share screen. To share sound, share A tab and leave Share sound on.",
  ),
  doc(
    "waiting-room",
    "The waiting room",
    "Choose who comes in",
    "Admit or Deny.",
  ),
];

describe("wordsOf", () => {
  it("drops filler and keeps stems", () => {
    expect(wordsOf("How do I share sounds?")).toEqual(
      expect.arrayContaining(["share", "sounds", "sound"]),
    );
    expect(wordsOf("How do I share sounds?")).not.toContain("how");
  });

  it("splits unspaced scripts into pairs of characters", () => {
    expect(wordsOf("画面共有")).toEqual(["画面", "面共", "共有"]);
  });
});

describe("nearest", () => {
  it("ranks the article that matches best first", () => {
    expect(nearest(DOCS, "How do I share sound?")[0]?.slug).toBe(
      "share-your-screen",
    );
  });

  it("finds nothing where no word matches", () => {
    expect(nearest(DOCS, "What's the weather in Paris?")).toEqual([]);
  });
});

describe("relevant", () => {
  it("answers a general question from the opening articles", () => {
    expect(
      relevant(DOCS, "What can you help with?").map((d) => d.slug),
    ).toEqual(["start-a-meeting", "join-a-meeting", "invite-people"]);
  });

  it("goes by what a specific question is about", () => {
    expect(relevant(DOCS, "admit people waiting")[0]?.slug).toBe(
      "waiting-room",
    );
  });
});

describe("promptFor", () => {
  it("puts the articles before the question", () => {
    const prompt = promptFor("How?", [DOCS[0] as Doc]);
    expect(prompt).toMatch(/^Help text:\n\n## Start a meeting\n/);
    expect(prompt.endsWith("Question: How?")).toBe(true);
  });
});
