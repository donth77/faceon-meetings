import { describe, expect, it } from "vitest";

import { checkWebhook, isOurWebhook, ourWebhook } from "./event-hooks";

const URL_HERE = "https://faceon.example.com/api/webhooks/stream";

describe("FaceOn's webhook in Stream", () => {
  it("is ours on any domain, by its path", () => {
    expect(isOurWebhook(URL_HERE)).toBe(true);
    expect(isOurWebhook("https://old.example.org/api/webhooks/stream")).toBe(
      true,
    );
    expect(isOurWebhook("https://faceon.example.com/api/other")).toBe(false);
    expect(isOurWebhook("not a url")).toBe(false);
    expect(isOurWebhook(undefined)).toBe(false);
  });

  it("is fine as stream:setup leaves it, among other hooks", () => {
    const other = { webhook_url: "https://elsewhere.example/hook" };
    expect(checkWebhook([other, ourWebhook(URL_HERE)], URL_HERE)).toEqual({
      state: "ok",
      url: URL_HERE,
      problems: [],
    });
    expect(checkWebhook([ourWebhook(URL_HERE)])).toMatchObject({
      state: "ok",
    });
  });

  it("is missing without a hook to its path", () => {
    expect(checkWebhook(undefined)).toEqual({ state: "missing" });
    expect(
      checkWebhook([{ webhook_url: "https://elsewhere.example/hook" }]),
    ).toEqual({ state: "missing" });
  });

  it("says what's wrong with it", () => {
    expect(
      checkWebhook([
        {
          ...ourWebhook(URL_HERE),
          enabled: false,
          product: "chat",
          event_types: ["call.session_participant_joined"],
        },
      ]),
    ).toEqual({
      state: "drift",
      url: URL_HERE,
      problems: [
        "turned off",
        "product: chat",
        "not sent: call.session_participant_left",
      ],
    });
  });

  it("points at another domain than the one given", () => {
    const old = "https://old.example.org/api/webhooks/stream";
    expect(checkWebhook([ourWebhook(old)], URL_HERE)).toEqual({
      state: "drift",
      url: old,
      problems: [`expected ${URL_HERE}`],
    });
  });

  it("looks at the hook to the address given, or one that's on", () => {
    const old = "https://old.example.org/api/webhooks/stream";
    const hooks = [
      { ...ourWebhook(old), enabled: false },
      ourWebhook(URL_HERE),
    ];
    expect(checkWebhook(hooks, URL_HERE)).toMatchObject({ state: "ok" });
    expect(checkWebhook(hooks)).toMatchObject({ state: "ok", url: URL_HERE });
  });
});
