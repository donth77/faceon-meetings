import { describe, expect, it } from "vitest";

import { matchLocale, preferredLanguages, supportedLocale } from "./match";

const SIX = ["en", "es", "pt-BR", "fr", "de", "ja"] as const;
const pick = (header: string | null) => matchLocale(header, SIX, "en");

describe("preferredLanguages", () => {
  it("orders the browser's languages by preference, as written", () => {
    expect(preferredLanguages("de;q=0.5, fr-CA, en;q=0.9, *;q=0.1")).toEqual([
      "fr-CA",
      "en",
      "de",
    ]);
    expect(preferredLanguages("es-MX,es;q=0")).toEqual(["es-MX"]);
    expect(preferredLanguages("")).toEqual([]);
    expect(preferredLanguages(null)).toEqual([]);
  });
});

describe("matchLocale", () => {
  it("gives every regional variant its base language", () => {
    expect(pick("en-GB")).toBe("en");
    expect(pick("en-IN,en;q=0.9")).toBe("en");
    expect(pick("es-MX")).toBe("es");
    expect(pick("es-419")).toBe("es");
    expect(pick("es-ES")).toBe("es");
    expect(pick("pt-BR")).toBe("pt-BR");
    expect(pick("pt-PT")).toBe("pt-BR");
    expect(pick("pt-AO,en;q=0.5")).toBe("pt-BR");
    expect(pick("pt")).toBe("pt-BR");
    expect(pick("fr-CA")).toBe("fr");
    expect(pick("fr-BE,fr;q=0.9")).toBe("fr");
    expect(pick("de-AT")).toBe("de");
    expect(pick("de-CH")).toBe("de");
    expect(pick("ja-JP")).toBe("ja");
  });

  it("skips languages FaceOn doesn't speak for the next one listed", () => {
    expect(pick("sv-SE,de;q=0.8,en;q=0.5")).toBe("de");
    expect(pick("nb-NO,nn;q=0.9,da;q=0.8,de;q=0.5")).toBe("de");
    expect(pick("ca-ES,es;q=0.9")).toBe("es");
  });

  it("falls back to English", () => {
    expect(pick("sv-SE")).toBe("en");
    expect(pick("zh-CN,zh;q=0.9")).toBe("en");
    expect(pick("")).toBe("en");
    expect(pick(null)).toBe("en");
  });
});

describe("supportedLocale", () => {
  it("matches a tag to a language FaceOn speaks, or nothing", () => {
    expect(supportedLocale("PT_br", SIX)).toBe("pt-BR");
    expect(supportedLocale("de-LI", SIX)).toBe("de");
    expect(supportedLocale("ko", SIX)).toBeUndefined();
    expect(supportedLocale(undefined, SIX)).toBeUndefined();
  });
});
