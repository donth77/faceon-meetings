import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { humanCheckFetchOptions, isHumanCheckError } from ".";

type FetchMock = ReturnType<
  typeof vi.fn<(...args: unknown[]) => Promise<Response>>
>;

const answer = (body: unknown, status = 200): FetchMock =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("passedHumanCheck", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function check(fetchMock: FetchMock, token?: string) {
    vi.stubGlobal("fetch", fetchMock);
    const { passedHumanCheck } = await import("./verify");
    return passedHumanCheck({ token, action: "guest-join", ip: "203.0.113.4" });
  }

  it("passes a genuine token made for this action", async () => {
    const fetchMock = answer({ success: true, action: "guest-join" });
    expect(await check(fetchMock, "tok")).toBe(true);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const form = init.body as URLSearchParams;
    expect(form.get("response")).toBe("tok");
    expect(form.get("remoteip")).toBe("203.0.113.4");
  });

  it("fails a token for another action, a rejected one, or none at all", async () => {
    expect(
      await check(answer({ success: true, action: "account" }), "tok"),
    ).toBe(false);
    expect(await check(answer({ success: false }), "tok")).toBe(false);
    expect(await check(answer({}, 500), "tok")).toBe(false);
    expect(await check(answer({ success: true }), undefined)).toBe(false);
  });

  it("fails closed when Cloudflare can't be reached", async () => {
    const unreachable: FetchMock = vi.fn(async () => {
      throw new TypeError("network");
    });
    expect(await check(unreachable, "tok")).toBe(false);
  });
});

describe("account checks", () => {
  it("send the token in the header Better Auth reads, and spot its errors", () => {
    expect(humanCheckFetchOptions("tok")).toEqual({
      headers: { "x-captcha-response": "tok" },
    });
    expect(humanCheckFetchOptions(undefined)).toBeUndefined();
    expect(isHumanCheckError({ code: "VERIFICATION_FAILED" })).toBe(true);
    expect(isHumanCheckError({ code: "MISSING_RESPONSE" })).toBe(true);
    expect(isHumanCheckError({ code: "INVALID_EMAIL" })).toBe(false);
    expect(isHumanCheckError(null)).toBe(false);
  });
});
