import { describe, expect, it } from "vitest";

import { parseFrontMatter } from "./front-matter";

describe("parseFrontMatter", () => {
  it("reads the fields and keeps the body", () => {
    const { fields, body } = parseFrontMatter(
      "---\ntitle: Share your screen\nsummary: A tab: or more\n---\n\n## Start\n",
    );
    expect(fields.get("title")).toBe("Share your screen");
    expect(fields.get("summary")).toBe("A tab: or more");
    expect(body).toBe("\n## Start\n");
  });

  it("handles Windows line endings", () => {
    const { fields } = parseFrontMatter("---\r\ntitle: Help\r\n---\r\nBody");
    expect(fields.get("title")).toBe("Help");
  });

  it("treats a file without front matter as all body", () => {
    const { fields, body } = parseFrontMatter("Just text");
    expect(fields.size).toBe(0);
    expect(body).toBe("Just text");
  });
});
