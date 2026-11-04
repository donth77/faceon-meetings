import { describe, expect, it } from "vitest";

import {
  modelLanguage,
  modelWrites,
  onDeviceNotesLanguage,
  optionsFor,
  type ModelApi,
} from "./built-in";

describe("modelLanguage", () => {
  it("writes in the languages Chrome documents the model writing", () => {
    expect(modelLanguage("en")).toBe("en");
    expect(modelLanguage("es")).toBe("es");
    expect(modelLanguage("fr")).toBe("fr");
    expect(modelLanguage("de")).toBe("de");
    expect(modelLanguage("ja")).toBe("ja");
    expect(modelLanguage("pt-BR")).toBeNull();
  });
});

describe("optionsFor", () => {
  it("reads English as well as the language it writes", () => {
    expect(optionsFor("ja")).toEqual({
      expectedInputs: [{ type: "text", languages: ["en", "ja"] }],
      expectedOutputs: [{ type: "text", languages: ["ja"] }],
    });
    expect(optionsFor("en").expectedInputs[0]?.languages).toEqual(["en"]);
  });
});

/** A model that writes `writes`, as availability() tells it; `here` false: no model at all. */
function model(writes: string[], here = true): ModelApi {
  return {
    availability: async (options) => {
      if (!here) return "unavailable";
      const language = options.expectedOutputs[0]?.languages[0] ?? "";
      return writes.includes(language) ? "available" : "unavailable";
    },
    create: async () => {
      throw new Error("not used");
    },
  };
}

describe("modelWrites", () => {
  it("asks the model, which can write more than Chrome documents", async () => {
    expect(await modelWrites(model(["en", "pt"]), "pt")).toBe(true);
  });

  it("says no when the model writes English but not the language", async () => {
    expect(await modelWrites(model(["en", "es"]), "fr")).toBe(false);
  });

  it("goes by Chrome's documented list where the model can't say", async () => {
    expect(await modelWrites(model([], false), "fr")).toBe(true);
    expect(await modelWrites(model([], false), "pt")).toBe(false);
    expect(await modelWrites(undefined, "de")).toBe(true);
    expect(await modelWrites(undefined, "pt")).toBe(false);
  });

  it("always writes English", async () => {
    expect(await modelWrites(model([]), "en")).toBe(true);
  });
});

describe("onDeviceNotesLanguage", () => {
  it("writes the reader's language where the model can", () => {
    expect(onDeviceNotesLanguage("fr", true)).toEqual({
      language: "fr",
      inEnglish: false,
    });
  });

  it("writes English instead, and says so, where it can't", () => {
    expect(onDeviceNotesLanguage("pt-BR", false)).toEqual({
      language: "en",
      inEnglish: true,
    });
  });

  it("has nothing to say for English", () => {
    expect(onDeviceNotesLanguage("en", false)).toEqual({
      language: "en",
      inEnglish: false,
    });
  });
});
