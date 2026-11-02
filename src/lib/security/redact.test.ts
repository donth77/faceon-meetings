import { describe, expect, it } from "vitest";

import { redactPath, redactText, redactUrl } from "./redact";

const SESSION = "0b0f9c1e-5a4b-4c3d-9e8f-7a6b5c4d3e2f";

describe("redactPath", () => {
  it("replaces meeting codes, sessions and other IDs", () => {
    expect(redactPath("/j/1234567890")).toBe("/j/:code");
    expect(redactPath("/es/j/1234567890")).toBe("/es/j/:code");
    expect(redactPath("/meetings/1234567890/edit")).toBe(
      "/meetings/:code/edit",
    );
    expect(redactPath(`/api/meetings/1234567890/notes/${SESSION}`)).toBe(
      "/api/meetings/:code/notes/:session",
    );
    expect(redactPath("/api/meetings/1234567890/admission/req_123")).toBe(
      "/api/meetings/:code/admission/:request",
    );
    expect(redactPath(`/previous/${SESSION}`)).toBe("/previous/:session");
    expect(redactPath("/avatar/0f1e2d3c4b5a6978-f.svg")).toBe("/avatar/:seed");
    expect(redactPath("/help/meeting-limits")).toBe("/help/meeting-limits");
  });
});

describe("redactUrl", () => {
  it("drops queries and fragments, and keeps only the path on the same site", () => {
    expect(
      redactUrl(
        "https://joinfaceon.app/j/1234567890?x=1#pwd=K7XQ2M",
        "https://joinfaceon.app",
      ),
    ).toBe("/j/:code");
    expect(redactUrl("https://api.openai.com/v1/chat/completions?key=1")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(redactUrl("/meetings/1234567890?occurrence=x")).toBe(
      "/meetings/:code",
    );
    expect(redactUrl("blob:https://joinfaceon.app/abc")).toBe("blob:");
  });
});

describe("redactText", () => {
  it("removes emails, keys, passcodes and long numbers from messages", () => {
    const text = redactText(
      "Failed for ada@example.com with sk-ant-abcdefghijklmnopqrstu at https://joinfaceon.app/j/1234567890#pwd=K7XQ2M (meeting 1234567890)",
    );
    expect(text).not.toMatch(/ada@|sk-ant|K7XQ2M|1234567890/);
    expect(text).toContain("[email]");
    expect(text).toContain("[secret]");
    expect(text).toContain("https://joinfaceon.app/j/:code");
  });
});
