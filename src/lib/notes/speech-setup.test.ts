import { afterEach, describe, expect, it, vi } from "vitest";

/** Chrome on a computer, whose language needs the one-time download, which takes a moment. */
function stubSpeech(result: boolean) {
  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", {
    userAgentData: { brands: [{ brand: "Google Chrome" }], mobile: false },
  });
  const install = vi.fn(
    () =>
      new Promise<boolean>((resolve) => setTimeout(() => resolve(result), 5)),
  );
  vi.stubGlobal("SpeechRecognition", {
    available: async () => (result ? "available" : "downloadable"),
    install,
  });
  return install;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("downloadSpeech", () => {
  it("downloads once, however many places ask at the same time", async () => {
    const install = stubSpeech(true);
    const { downloadSpeech } = await import("./speech-setup");
    const asked = [downloadSpeech("en-US"), downloadSpeech("en-US")];
    expect(await Promise.all(asked)).toEqual([true, true]);
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("says when it didn't finish, so it can be tried again", async () => {
    const install = stubSpeech(false);
    const { downloadSpeech } = await import("./speech-setup");
    expect(await downloadSpeech("en-US")).toBe(false);
    expect(await downloadSpeech("en-US")).toBe(false);
    expect(install).toHaveBeenCalledTimes(2);
  });
});

describe("speech in other Chromium browsers", () => {
  it("never asks other Chromium browsers, where asking can crash the page", async () => {
    const available = vi.fn(async () => "available");
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {
      userAgentData: { brands: [{ brand: "Chromium" }], mobile: false },
    });
    vi.stubGlobal("SpeechRecognition", { available });
    const { downloadSpeech } = await import("./speech-setup");
    expect(await downloadSpeech("en-US")).toBe(false);
    expect(available).not.toHaveBeenCalled();
  });
});
