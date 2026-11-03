import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProject, problemOf, updateContent } from "./apps-script";

/** A fetch that answers once, and remembers what it was asked. */
function answering(status: number, body: unknown) {
  return vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createProject", () => {
  it("makes a project with the person's token, and gives its ID", async () => {
    const fetcher = answering(200, { scriptId: "1AbC", title: "FaceOn" });
    expect(await createProject("token-1", "FaceOn", fetcher)).toEqual({
      ok: true,
      value: { scriptId: "1AbC" },
    });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://script.googleapis.com/v1/projects");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer token-1",
    );
    expect(JSON.parse(String(init?.body))).toEqual({ title: "FaceOn" });
  });

  it("fails on an answer without an ID", async () => {
    expect(await createProject("t", "FaceOn", answering(200, {}))).toEqual({
      ok: false,
      problem: { kind: "failed" },
    });
  });

  it("fails when Google can't be reached", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await createProject("t", "FaceOn", offline)).toEqual({
      ok: false,
      problem: { kind: "failed" },
    });
  });
});

describe("updateContent", () => {
  it("replaces the project's files", async () => {
    const fetcher = answering(200, { scriptId: "1AbC", files: [] });
    const files = [
      { name: "appsscript", type: "JSON" as const, source: "{}" },
      { name: "Code", type: "SERVER_JS" as const, source: "var a;" },
    ];
    expect(await updateContent("t", "1AbC", files, fetcher)).toEqual({
      ok: true,
      value: null,
    });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://script.googleapis.com/v1/projects/1AbC/content");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ files });
  });

  it("says when the project is gone", async () => {
    const gone = answering(404, { error: { code: 404, message: "Not found" } });
    expect(await updateContent("t", "1AbC", [], gone)).toEqual({
      ok: false,
      problem: { kind: "missing" },
    });
  });
});

describe("problemOf", () => {
  it("knows the person's own Apps Script API setting is off", () => {
    expect(
      problemOf(403, {
        error: {
          code: 403,
          status: "PERMISSION_DENIED",
          message:
            "User has not enabled the Apps Script API. Enable it by visiting https://script.google.com/home/usersettings then retry.",
        },
      }),
    ).toEqual({ kind: "userApiOff" });
  });

  it("knows FaceOn's Cloud project lacks the API, with where to turn it on", () => {
    const activationUrl =
      "https://console.developers.google.com/apis/api/script.googleapis.com/overview?project=123";
    expect(
      problemOf(403, {
        error: {
          code: 403,
          message:
            "Apps Script API has not been used in project 123 before or it is disabled.",
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.ErrorInfo",
              reason: "SERVICE_DISABLED",
              metadata: { activationUrl, service: "script.googleapis.com" },
            },
          ],
        },
      }),
    ).toEqual({ kind: "serviceDisabled", consoleUrl: activationUrl });
    // The older shape: the link is only in the message.
    expect(
      problemOf(403, {
        error: {
          message: `Access Not Configured. Enable it by visiting ${activationUrl} then retry.`,
          errors: [{ reason: "accessNotConfigured" }],
        },
      }),
    ).toEqual({ kind: "serviceDisabled", consoleUrl: activationUrl });
  });

  it("asks Google again when the token is refused or lacks the scope", () => {
    expect(problemOf(401, null)).toEqual({ kind: "auth" });
    expect(
      problemOf(403, {
        error: {
          message: "Request had insufficient authentication scopes.",
          details: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }],
        },
      }),
    ).toEqual({ kind: "auth" });
  });

  it("takes any other refusal as Google not allowing it, and the rest as passing", () => {
    expect(
      problemOf(403, {
        error: { message: "The caller does not have permission" },
      }),
    ).toEqual({ kind: "blocked" });
    expect(problemOf(429, null)).toEqual({ kind: "failed" });
    expect(problemOf(500, "<html>")).toEqual({ kind: "failed" });
  });
});
