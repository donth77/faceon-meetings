import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Rule = "bypass" | "page" | "static" | "asset" | "fresh";

/** The service worker as shipped (public/sw.js), loaded with just enough of `self`. */
function loadWorker() {
  const source = readFileSync(
    path.join(process.cwd(), "public", "sw.js"),
    "utf8",
  );
  const scope: Record<string, unknown> = {
    URL,
    self: {
      location: { origin: ORIGIN },
      addEventListener: () => {},
      registration: {},
      clients: {},
    },
  };
  runInNewContext(source, scope);
  return {
    cacheRule: scope.cacheRule as (request: {
      url: URL;
      origin: string;
      method: string;
      mode: string;
      range: boolean;
      rsc: boolean;
    }) => Rule,
    notificationTarget: scope.notificationTarget as (
      data: unknown,
      origin: string,
    ) => string,
  };
}

const ORIGIN = "https://faceon.example";
const { cacheRule, notificationTarget } = loadWorker();

const rule = (
  address: string,
  request: Partial<{
    method: string;
    mode: string;
    range: boolean;
    rsc: boolean;
  }> = {},
) =>
  cacheRule({
    url: new URL(address, ORIGIN),
    origin: ORIGIN,
    method: "GET",
    mode: "no-cors",
    range: false,
    rsc: false,
    ...request,
  });

describe("the service worker's cache rules", () => {
  it("loads pages from the network, with the offline page as the fallback", () => {
    expect(rule("/home", { mode: "navigate" })).toBe("page");
    expect(rule("/j/1234567890", { mode: "navigate" })).toBe("page");
  });

  it("never touches the API, sign-in included, even as a page", () => {
    expect(rule("/api/meetings/1234567890/join", { method: "POST" })).toBe(
      "bypass",
    );
    expect(rule("/api/auth/get-session")).toBe("bypass");
    expect(rule("/api/auth/callback/google", { mode: "navigate" })).toBe(
      "bypass",
    );
  });

  it("never touches other sites, uploads, ranges or the router's own requests", () => {
    expect(rule("https://video.stream-io-api.com/video/connect")).toBe(
      "bypass",
    );
    expect(rule("/home", { method: "POST" })).toBe("bypass");
    expect(rule("/backgrounds/motion/aurora.mp4", { range: true })).toBe(
      "bypass",
    );
    expect(rule("/home", { rsc: true })).toBe("bypass");
    expect(rule("/upcoming?_rsc=1x2y3")).toBe("bypass");
  });

  it("never caches media, even without a range", () => {
    expect(rule("/backgrounds/motion/aurora.mp4")).toBe("bypass");
    expect(rule("/sounds/join.mp3")).toBe("bypass");
  });

  it("keeps build files, whose names change with their content", () => {
    expect(rule("/_next/static/chunks/app-3f2a.js")).toBe("static");
    expect(rule("/_next/static/media/figtree.woff2")).toBe("static");
  });

  it("keeps backgrounds and icons, refreshed for next time", () => {
    for (const address of [
      "/backgrounds/coast.webp",
      "/backgrounds/thumbs/coast.webp",
      "/backgrounds/blue.svg",
      "/icons/icon-192.png",
      "/manifest.webmanifest",
      "/favicon.ico",
      "/avatar/f1e2d3c4b5a69788-f.svg",
    ]) {
      expect(rule(address)).toBe("asset");
    }
  });

  it("lets the network decide the effects engine's files, which must match", () => {
    expect(rule("/effects/vision_wasm_internal.wasm")).toBe("fresh");
    expect(rule("/effects/vision_wasm_internal.js")).toBe("fresh");
    expect(rule("/effects/selfie_segmenter_landscape.tflite")).toBe("fresh");
  });

  it("leaves everything else to the browser", () => {
    expect(rule("/llms.txt")).toBe("bypass");
    expect(rule("/opengraph-image.png")).toBe("bypass");
    expect(rule("/_next/image?url=%2Fbrand%2Flogo.png&w=64&q=75")).toBe(
      "bypass",
    );
  });
});

describe("a meeting reminder's notification", () => {
  it("opens the meeting it's about", () => {
    expect(
      notificationTarget({ url: "/j/1234567890#pwd=K7XQ2M" }, ORIGIN),
    ).toBe(`${ORIGIN}/j/1234567890#pwd=K7XQ2M`);
  });

  it("never leads to another site", () => {
    for (const data of [
      { url: "https://elsewhere.example/j/1" },
      { url: "//elsewhere.example/j/1" },
      undefined,
      null,
    ]) {
      expect(notificationTarget(data, ORIGIN)).toBe(`${ORIGIN}/`);
    }
  });
});
