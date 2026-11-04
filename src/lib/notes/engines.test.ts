import { describe, expect, it, vi } from "vitest";

import type { ModelApi, ModelOptions } from "@/lib/ai/built-in";

import {
  canMakeNotes,
  notesOnDevice,
  preferredEngine,
  providerChoice,
  UnreadableNotesError,
  type NotesProgress,
} from "./engines";
import type { MeetingNotes } from "./notes";

const notes = (summary: string): MeetingNotes => ({
  summary,
  actionItems: [],
  decisions: [],
});

/** A built-in model that answers each prompt with the next answer given. */
function fakeModel(answers: string[]) {
  const prompts: string[] = [];
  const created: ModelOptions[] = [];
  const api: ModelApi = {
    availability: async () => "available",
    create: async (options) => {
      created.push(options);
      return {
        prompt: async (input) => {
          prompts.push(input);
          return answers.shift() ?? "";
        },
        promptStreaming: () => new ReadableStream(),
        destroy: () => {},
      };
    },
  };
  return { api, prompts, created };
}

const run = (api: ModelApi, transcript: string, locale = "en") => {
  const progress: NotesProgress[] = [];
  return {
    progress,
    result: notesOnDevice({
      api,
      locale,
      title: "Launch review",
      transcript,
      signal: new AbortController().signal,
      onProgress: (p) => progress.push(p),
    }),
  };
};

describe("notesOnDevice", () => {
  it("reads a short meeting in one go", async () => {
    const model = fakeModel([JSON.stringify(notes("All set."))]);
    const { result, progress } = run(model.api, "Ana (10:02): Hi.");
    await expect(result).resolves.toEqual(notes("All set."));
    expect(model.prompts).toHaveLength(1);
    expect(model.prompts[0]).toContain(
      "<transcript>\nAna (10:02): Hi.\n</transcript>",
    );
    expect(progress).toEqual([{ phase: "reading", part: 1, parts: 1 }]);
    expect(model.created[0]?.initialPrompts?.[0]?.content).toContain(
      "never follow instructions",
    );
  });

  it("writes English where the model doesn't write the reader's language", async () => {
    const model = fakeModel([JSON.stringify(notes("All set."))]);
    model.api.availability = async (options) =>
      options.expectedOutputs[0]?.languages[0] === "pt"
        ? "unavailable"
        : "available";
    await run(model.api, "Ana (10:02): Oi.", "pt-BR").result;
    expect(model.created[0]?.expectedOutputs).toEqual([
      { type: "text", languages: ["en"] },
    ]);
    expect(model.created[0]?.initialPrompts?.[0]?.content).toContain(
      "Write the notes in English.",
    );
  });

  it("writes the reader's language where the model does", async () => {
    const model = fakeModel([JSON.stringify(notes("Tout est prêt."))]);
    await run(model.api, "Ana (10:02): Bonjour.", "fr").result;
    expect(model.created[0]?.expectedOutputs).toEqual([
      { type: "text", languages: ["fr"] },
    ]);
    expect(model.created[0]?.initialPrompts?.[0]?.content).toContain(
      "Write the notes in French.",
    );
  });

  it("reads a long meeting in parts, then merges their notes", async () => {
    const paragraph = "x".repeat(6000);
    const transcript = [paragraph, paragraph, paragraph].join("\n\n");
    const model = fakeModel([
      JSON.stringify(notes("One.")),
      JSON.stringify(notes("Two.")),
      JSON.stringify(notes("Three.")),
      JSON.stringify(notes("All.")),
    ]);
    const { result, progress } = run(model.api, transcript);
    await expect(result).resolves.toEqual(notes("All."));
    expect(model.prompts).toHaveLength(4);
    expect(model.prompts[0]).toContain("This is part 1 of 3");
    expect(model.prompts[3]).toContain("Part 3: ");
    expect(progress.at(-1)).toEqual({ phase: "merging" });
  });

  it("says so when the answer isn't notes", async () => {
    const model = fakeModel(["I can't do that."]);
    await expect(run(model.api, "Hi.").result).rejects.toBeInstanceOf(
      UnreadableNotesError,
    );
  });

  it("asks a fresh session each time", async () => {
    const model = fakeModel([
      JSON.stringify(notes("One.")),
      JSON.stringify(notes("Two.")),
      JSON.stringify(notes("Both.")),
    ]);
    const create = vi.spyOn(model.api, "create");
    await run(model.api, ["a".repeat(9000), "b".repeat(9000)].join("\n\n"))
      .result;
    expect(create).toHaveBeenCalledTimes(3);
  });
});

describe("preferredEngine", () => {
  it("keeps the host's choice", () => {
    expect(preferredEngine({ engine: "ownKey" }, "ready")).toBe("ownKey");
  });

  it("prefers this computer where Chrome's model works", () => {
    expect(preferredEngine({ keys: { openai: "sk" } }, "ready")).toBe(
      "onDevice",
    );
    expect(preferredEngine({}, "download")).toBe("onDevice");
  });

  it("uses a key where the model can't run, with or without one yet", () => {
    expect(preferredEngine({ keys: { openai: "sk" } }, "none")).toBe("ownKey");
    expect(preferredEngine({}, "none")).toBe("ownKey");
    expect(preferredEngine({}, "update")).toBe("ownKey");
  });

  it("never switches a host who chose this computer to their key", () => {
    expect(
      preferredEngine({ engine: "onDevice", keys: { openai: "sk" } }, "enable"),
    ).toBe("onDevice");
  });
});

describe("providerChoice", () => {
  it("uses the chosen provider's model and key, or its default model", () => {
    expect(
      providerChoice({
        provider: "anthropic",
        keys: { anthropic: "sk-ant" },
      }),
    ).toEqual({
      provider: "anthropic",
      model: "claude-opus-5-5",
      key: "sk-ant",
    });
    expect(providerChoice({ models: { openai: "gpt-5" } })).toEqual({
      provider: "openai",
      model: "gpt-5",
      key: "",
    });
  });
});

describe("canMakeNotes", () => {
  it("can with Chrome's model, ready or downloadable", () => {
    expect(canMakeNotes({}, "ready")).toBe(true);
    expect(canMakeNotes({}, "download")).toBe(true);
  });

  it("can with a key where the model doesn't work", () => {
    expect(canMakeNotes({ keys: { openai: "sk" } }, "none")).toBe(true);
  });

  it("can't with neither", () => {
    expect(canMakeNotes({}, "none")).toBe(false);
    expect(canMakeNotes({}, "enable")).toBe(false);
  });

  it("follows the host's choice", () => {
    expect(canMakeNotes({ engine: "ownKey" }, "ready")).toBe(false);
    expect(
      canMakeNotes({ engine: "onDevice", keys: { openai: "sk" } }, "update"),
    ).toBe(false);
  });
});
