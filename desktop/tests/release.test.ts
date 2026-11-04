import { describe, expect, it } from "vitest";

import {
  alreadyPublished,
  ensureDraftRelease,
  releaseForTag,
  releaseTag,
  uploadReleaseFiles,
} from "../scripts/release.mjs";

type Call = { url: string; method: string; body?: unknown };
type Listed = {
  id?: number;
  tag_name: string;
  draft: boolean;
  assets?: { id: number; name: string }[];
};

/** A stand-in for GitHub's API: the releases it lists, and every call it got. */
function github(releases: Listed[], status = 200) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body;
    calls.push({
      url,
      method,
      body:
        typeof body === "string"
          ? JSON.parse(body)
          : body
            ? new TextDecoder().decode(body as Uint8Array)
            : undefined,
    });
    if (method === "GET") {
      const listed = releases.map((release) => ({
        id: 1,
        assets: [],
        ...release,
      }));
      return new Response(JSON.stringify(listed), { status });
    }
    return new Response(method === "DELETE" ? null : "{}", {
      status: method === "DELETE" ? 204 : 201,
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

  it("leaves an existing draft alone", async () => {
    const { calls, fetchImpl } = github([{ tag_name: "v1.2.3", draft: true }]);
    await expect(ensureDraftRelease({ ...options, fetchImpl })).resolves.toBe(
      "exists",
    );
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("says when the version is already published, rather than uploading nowhere", async () => {
    const { calls, fetchImpl } = github([{ tag_name: "v1.2.3", draft: false }]);
    await expect(ensureDraftRelease({ ...options, fetchImpl })).resolves.toBe(
      "published",
    );
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
    const message = alreadyPublished("v1.2.3", "owner/releases");
    expect(message).toMatch(/v1\.2\.3 is already published in owner\/releases/);
    expect(message).toMatch(/Raise "version"/);
    expect(message).toMatch(/--attach/);
  });

  it("stops when GitHub won't list the releases", async () => {
    const { fetchImpl } = github([], 401);
    await expect(ensureDraftRelease({ ...options, fetchImpl })).rejects.toThrow(
      /HTTP 401/,
    );
  });
});

describe("uploading a build's files to its release", () => {
  const files = ["/out/FaceOn.dmg", "/out/latest-mac.yml"];
  const read = async (path: string) =>
    new TextEncoder().encode(`bytes of ${path}`);
  const upload = { ...options, files, read };

  it("replaces a file of the same name and adds the rest, on the release's upload address", async () => {
    const { calls, fetchImpl } = github([
      {
        id: 42,
        tag_name: "v1.2.3",
        draft: true,
        assets: [
          { id: 7, name: "FaceOn.dmg" },
          { id: 8, name: "FaceOn-Setup.exe" },
        ],
      },
    ]);
    await expect(
      uploadReleaseFiles({ ...upload, allowPublished: false, fetchImpl }),
    ).resolves.toEqual(["FaceOn.dmg", "latest-mac.yml"]);
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "GET https://api.github.com/repos/owner/releases/releases?per_page=100",
      "DELETE https://api.github.com/repos/owner/releases/releases/assets/7",
      "POST https://uploads.github.com/repos/owner/releases/releases/42/assets?name=FaceOn.dmg",
      "POST https://uploads.github.com/repos/owner/releases/releases/42/assets?name=latest-mac.yml",
    ]);
    expect(calls[2]?.body).toBe("bytes of /out/FaceOn.dmg");
  });

  it("adds to a published release only when attaching", async () => {
    const published = [{ id: 42, tag_name: "v1.2.3", draft: false }];
    await expect(
      uploadReleaseFiles({
        ...upload,
        allowPublished: false,
        fetchImpl: github(published).fetchImpl,
      }),
    ).rejects.toThrow(/already published/);
    await expect(
      uploadReleaseFiles({
        ...upload,
        allowPublished: true,
        fetchImpl: github(published).fetchImpl,
      }),
    ).resolves.toEqual(["FaceOn.dmg", "latest-mac.yml"]);
  });

  it("needs the release to exist", async () => {
    const { calls, fetchImpl } = github([{ tag_name: "v1.2.2", draft: false }]);
    await expect(
      uploadReleaseFiles({ ...upload, allowPublished: true, fetchImpl }),
    ).rejects.toThrow(/has no release v1\.2\.3/);
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });
});
