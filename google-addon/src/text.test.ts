import { describe, expect, it } from "vitest";

import { format, languageOf, translator } from "./text";

describe("languageOf", () => {
  it("picks the person's language, or its base, or English", () => {
    expect(languageOf("pt-BR", ["en", "pt-BR"])).toBe("pt-BR");
    expect(languageOf("en-GB", ["en", "de"])).toBe("en");
    expect(languageOf("de_AT", ["en", "de"])).toBe("de");
    expect(languageOf("ko", ["en", "de"])).toBe("en");
    expect(languageOf(undefined, ["en"])).toBe("en");
  });
});

describe("format", () => {
  it("fills in values by name and leaves unknown ones", () => {
    expect(
      format("Join {title} at {time}", { title: "Standup", time: "9:00" }),
    ).toBe("Join Standup at 9:00");
    expect(format("Hi {name}")).toBe("Hi {name}");
  });
});

describe("translator", () => {
  const texts = {
    en: { home: { title: "{appName}", start: "Start a meeting" } },
    de: { home: { start: "Meeting starten" } },
  };

  it("uses the person's language, falling back to English, then the key", () => {
    const de = translator(texts, "de-DE", "FaceOn");
    expect(de("home.start")).toBe("Meeting starten");
    expect(de("home.title")).toBe("FaceOn");
    expect(de("home.missing")).toBe("home.missing");
  });
});
