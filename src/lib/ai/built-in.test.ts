import { describe, expect, it } from "vitest";

import { modelLanguage, optionsFor } from "./built-in";

describe("modelLanguage", () => {
  it("writes in the languages the model writes", () => {
    expect(modelLanguage("en")).toBe("en");
    expect(modelLanguage("es")).toBe("es");
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
