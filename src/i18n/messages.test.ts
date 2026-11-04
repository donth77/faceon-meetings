import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  parse,
  TYPE,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";

import { routing } from "./routing";

type Tree = { [key: string]: string | Tree };

const folder = path.resolve("messages");
const files = readdirSync(folder)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.slice(0, -".json".length))
  .sort();

function read(locale: string): Tree {
  return JSON.parse(readFileSync(path.join(folder, `${locale}.json`), "utf8"));
}

/** Every message by its key ("Meeting.mute"). */
function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const flat = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const at = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") flat.set(at, value);
    else for (const [inner, text] of flatten(value, at)) flat.set(inner, text);
  }
  return flat;
}

const english = flatten(read("en"));
const translations = files.filter((locale) => locale !== "en");

/** What a message asks of the code: its arguments, by kind, and its tags. */
type Shape = { args: string[]; tags: string[] };

/** The plural branches in a message, each with the selectors it offers. */
type Plural = { name: string; selectors: string[] };

function walk(
  elements: MessageFormatElement[],
  found: { args: Set<string>; tags: Set<string>; plurals: Plural[] },
) {
  for (const element of elements) {
    switch (element.type) {
      case TYPE.argument:
        found.args.add(`${element.value}:text`);
        break;
      case TYPE.number:
        found.args.add(`${element.value}:number`);
        break;
      case TYPE.date:
      case TYPE.time:
        found.args.add(`${element.value}:date`);
        break;
      case TYPE.select:
        found.args.add(`${element.value}:select`);
        for (const option of Object.values(element.options)) {
          walk(option.value, found);
        }
        break;
      case TYPE.plural:
        found.args.add(`${element.value}:plural`);
        if (element.pluralType === "cardinal") {
          found.plurals.push({
            name: element.value,
            selectors: Object.keys(element.options),
          });
        }
        for (const option of Object.values(element.options)) {
          walk(option.value, found);
        }
        break;
      case TYPE.tag:
        found.tags.add(element.value);
        walk(element.children, found);
        break;
      default:
        break;
    }
  }
}

function analyze(message: string) {
  const found = {
    args: new Set<string>(),
    tags: new Set<string>(),
    plurals: [] as Plural[],
  };
  walk(parse(message, { requiresOtherClause: true }), found);
  const shape: Shape = {
    args: [...found.args].sort(),
    tags: [...found.tags].sort(),
  };
  return { shape, plurals: found.plurals };
}

describe("message files", () => {
  it("are the languages the app offers, English first", () => {
    expect(files).toEqual([...routing.locales].sort());
    expect(routing.defaultLocale).toBe("en");
  });

  it.each(files)("%s: every message is valid ICU", (locale) => {
    for (const [key, message] of flatten(read(locale))) {
      expect(() => analyze(message), `${locale} ${key}`).not.toThrow();
    }
  });
});

describe.skipIf(translations.length === 0)("translations", () => {
  it.each(translations)("%s has every message, and nothing else", (locale) => {
    const messages = flatten(read(locale));
    const missing = [...english.keys()].filter((key) => !messages.has(key));
    const extra = [...messages.keys()].filter((key) => !english.has(key));
    expect(missing, `${locale} is missing`).toEqual([]);
    expect(extra, `${locale} has extra`).toEqual([]);
  });

  it.each(translations)(
    "%s keeps every placeholder, plural, select and tag",
    (locale) => {
      const messages = flatten(read(locale));
      for (const [key, source] of english) {
        const message = messages.get(key);
        if (message === undefined) continue;
        expect(analyze(message).shape, `${locale} ${key}`).toEqual(
          analyze(source).shape,
        );
      }
    },
  );

  it.each(translations)(
    "%s gives each plural its language's forms",
    (locale) => {
      const categories = new Intl.PluralRules(locale).resolvedOptions()
        .pluralCategories as string[];
      for (const [key, message] of flatten(read(locale))) {
        for (const { name, selectors } of analyze(message).plurals) {
          const at = `${locale} ${key} {${name}}`;
          const words = selectors.filter(
            (selector) => !selector.startsWith("="),
          );
          for (const word of words) expect(categories, at).toContain(word);
          expect(selectors, at).toContain("other");
          if (categories.includes("one") && !selectors.includes("=1")) {
            expect(selectors, at).toContain("one");
          }
        }
      }
    },
  );

  it.each(translations)("%s isn't left in English", (locale) => {
    const messages = flatten(read(locale));
    const same = [...english].filter(
      ([key, source]) =>
        messages.get(key) === source &&
        /[a-z]{4,}/i.test(source.replace(/\{[^}]*\}|<[^>]*>/g, "")),
    );
    // Some words read the same in many languages (Chat, Live, FaceOn's own names);
    // anything more than a handful means a section was missed.
    expect(same.length, same.map(([key]) => key).join(", ")).toBeLessThan(40);
  });
});

describe("the add-on's text", () => {
  it.each(files)(
    "%s uses only plain {name} values, which is all the add-on fills in",
    (locale) => {
      for (const [key, message] of flatten(read(locale))) {
        if (!key.startsWith("GoogleAddon.")) continue;
        const { shape } = analyze(message);
        for (const arg of shape.args) {
          expect(arg, `${locale} ${key}`).toMatch(/:text$/);
        }
        expect(shape.tags, `${locale} ${key}`).toEqual([]);
      }
    },
  );
});
