import { describe, expect, it } from "vitest";

import { errorOf } from "./api-errors";
import { conferencePlan } from "./conference-plan";
import { translator } from "./text";

const t = translator(
  {
    en: {
      conference: {
        note: "Join from any browser, on a computer or a phone. No download needed.",
      },
    },
  },
  "en",
  "FaceOn",
);

describe("conferencePlan", () => {
  it("turns FaceOn's meeting into Calendar's conference details", () => {
    expect(
      conferencePlan(
        {
          ok: true,
          data: {
            code: "1234567890",
            meetingId: "123 456 7890",
            joinUrl: "https://faceon.test/j/1234567890#pwd=K7XQ2M",
            passcode: "K7XQ2M",
          },
        },
        t,
      ),
    ).toEqual({
      kind: "meeting",
      code: "1234567890",
      meetingId: "123 456 7890",
      joinUrl: "https://faceon.test/j/1234567890#pwd=K7XQ2M",
      passcode: "K7XQ2M",
      notes:
        "Join from any browser, on a computer or a phone. No download needed.",
    });
  });

  it("turns FaceOn's errors into Google's", () => {
    const plan = (error: Parameters<typeof conferencePlan>[0]) =>
      conferencePlan(error, t);
    expect(
      plan({
        ok: false,
        error: { code: "AUTHENTICATION", link: "https://faceon.test/sign-in" },
      }),
    ).toEqual({
      kind: "error",
      type: "AUTHENTICATION",
      authenticationUrl: "https://faceon.test/sign-in",
    });
    expect(
      plan({ ok: false, error: { code: "PERMANENT", reason: "dailyLimit" } }),
    ).toEqual({
      kind: "error",
      type: "PERMANENT",
    });
    expect(plan({ ok: false, error: { code: "INVALID_TOKEN" } })).toMatchObject(
      { type: "PERMANENT" },
    );
    expect(plan({ ok: false, error: { code: "TEMPORARY" } })).toMatchObject({
      type: "TEMPORARY",
    });
    expect(plan({ ok: false, error: { code: "RATE_LIMITED" } })).toMatchObject({
      type: "TEMPORARY",
    });
  });
});

describe("errorOf", () => {
  it("reads FaceOn's error body, or works one out from the status", () => {
    expect(
      errorOf(422, '{"error":{"code":"PERMANENT","reason":"dailyLimit"}}'),
    ).toEqual({
      code: "PERMANENT",
      reason: "dailyLimit",
    });
    expect(errorOf(401, "<html>")).toEqual({ code: "INVALID_TOKEN" });
    expect(errorOf(502, "Bad gateway")).toEqual({ code: "TEMPORARY" });
  });
});
