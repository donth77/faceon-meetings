import { describe, expect, it } from "vitest";

import {
  ensureDraftRelease,
  releaseForTag,
  releaseTag,
} from "../scripts/release.mjs";

type Call = { url: string; method: string; body?: unknown };

/** A stand-in for GitHub's API: the releases it lists, and every call it got. */
function github(
  releases: { tag_name: string; draft: boolean }[],
  status = 200,
) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({
      url,
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(method === "GET" ? JSON.stringify(releases) : "{}", {
      status: method === "GET" ? status : 201,
    });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const options = {
  repo: "owner/releases",
  token: "token",
  version: "1.2.3",
  name: "FaceOn 1.2.3",
};

describe("the draft release a publish uploads to", () => {
  it("is tagged as electron-builder tags it", () => {
    expect(releaseTag("1.2.3")).toBe("v1.2.3");
  });

  it("finds a release by its tag, draft or not", () => {
    const releases = [
      { tag_name: "v1.2.2", draft: false },
      { tag_name: "v1.2.3", draft: true },
    ];
    expect(releaseForTag(releases, "v1.2.3")).toBe(releases[1]);
    expect(releaseForTag(releases, "v9.9.9")).toBeNull();
  });

  it("makes the draft when the version has none, so every upload lands in it", async () => {
    const { calls, fetchImpl } = github([{ tag_name: "v1.2.2", draft: false }]);
    await expect(ensureDraftRelease({ ...options, fetchImpl })).resolves.toBe(
      "created",
    );
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST"]);
    expect(calls[1]).toMatchObject({
      url: "https://api.github.com/repos/owner/releases/releases",
      body: { tag_name: "v1.2.3", name: "FaceOn 1.2.3", draft: true },
    });
  });

  it("leaves an existing release alone", async () => {
    const { calls, fetchImpl } = github([{ tag_name: "v1.2.3", draft: true }]);
    await expect(ensureDraftRelease({ ...options, fetchImpl })).resolves.toBe(
      "exists",
    );
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("stops when GitHub won't list the releases", async () => {
    const { fetchImpl } = github([], 401);
    await expect(ensureDraftRelease({ ...options, fetchImpl })).rejects.toThrow(
      /HTTP 401/,
    );
  });
});
