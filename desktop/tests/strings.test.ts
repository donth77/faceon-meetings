import { describe, expect, it } from "vitest";

import { routing } from "../../src/i18n/routing";
import {
  languageFor,
  setLanguage,
  strings,
  translations,
  withoutAccessKey,
  type Strings,
} from "../src/main/strings";

const english = translations.en as Strings;
const keys = Object.keys(english).sort();
const menus = [
  "fileMenu",
  "editMenu",
  "viewMenu",
  "windowMenu",
  "helpMenu",
] as const;

/** Every string a language shows, with its functions called on sample values. */
function shown(words: Strings): Record<string, string> {
  return Object.fromEntries(
    Object.entries(words).map(([key, value]) => [
      key,
      typeof value === "function"
        ? (value as (...args: unknown[]) => string)("FaceOn", "1.2.3")
        : value,
    ]),
  );
}

describe("the shell's strings", () => {
  it("speak every language the web app does", () => {
    expect(Object.keys(translations).sort()).toEqual(
      [...routing.locales].sort(),
    );
  });

  it.each(Object.keys(translations))(
    "%s has every string, none empty",
    (language) => {
      const words = translations[language] as Strings;
      expect(Object.keys(words).sort()).toEqual(keys);
      for (const key of keys) {
        const value = words[key as keyof Strings];
        const source = english[key as keyof Strings];
        expect(typeof value, key).toBe(typeof source);
        if (typeof value === "function" && typeof source === "function") {
          expect(value.length, key).toBe(source.length);
        }
      }
      for (const [key, text] of Object.entries(shown(words))) {
        expect(text.trim(), key).not.toBe("");
      }
    },
  );

  it.each(Object.keys(translations))(
    "%s puts in the names, numbers and titles",
    (language) => {
      const words = translations[language] as Strings;
      expect(words.about("FaceOn")).toContain("FaceOn");
      expect(words.quit("FaceOn")).toContain("FaceOn");
      expect(words.joinNext("Standup")).toContain("Standup");
      expect(words.updateReady("FaceOn", "1.2.3")).toContain("1.2.3");
      for (const count of [1, 2, 5, 21]) {
        expect(words.startsIn(count)).toContain(String(count));
        expect(words.unread(count)).toContain(String(count));
      }
    },
  );

  it.each(Object.keys(translations))(
    "%s marks one access key in each menu name",
    (language) => {
      const words = translations[language] as Strings;
      for (const menu of menus) {
        expect(words[menu].match(/&./g), `${language} ${menu}`).toHaveLength(1);
        expect(withoutAccessKey(words[menu])).not.toContain("&");
      }
    },
  );
});

describe("withoutAccessKey", () => {
  it("drops the marker, and a Japanese-style key in parentheses", () => {
    expect(withoutAccessKey("&File")).toBe("File");
    expect(withoutAccessKey("Ansich&t")).toBe("Ansicht");
    expect(withoutAccessKey("ファイル(&F)")).toBe("ファイル");
  });
});

describe("languageFor", () => {
  it("picks the first language the shell speaks, by base language, else English", () => {
    expect(languageFor([undefined, "en-GB"])).toBe("en");
    expect(languageFor(["sv-SE"])).toBe("en");
    expect(languageFor([])).toBe("en");
    for (const language of Object.keys(translations)) {
      expect(languageFor([language])).toBe(language);
      expect(languageFor(["xx", `${language.split("-")[0]}-ZZ`])).toBe(
        language,
      );
    }
  });

  it("switches the words, and says when nothing changed", () => {
    expect(setLanguage("en")).toBe(false);
    expect(setLanguage("not-a-language")).toBe(false);
    expect(strings.help).toBe(english.help);
  });
});
