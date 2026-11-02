import { afterEach, describe, expect, it, vi } from "vitest";

/** A browser whose language needs the one-time download, which takes a moment. */
function stubSpeech(result: boolean) {
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
