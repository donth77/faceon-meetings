import { afterEach, describe, expect, it, vi } from "vitest";

import {
  speechLanguage,
  startTranscribing,
  transcriptionStatus,
  type SpeechApi,
} from "./speech";

describe("speechLanguage", () => {
  it("uses the browser's regional form of the app's language", () => {
    expect(speechLanguage("en", ["en-GB", "en"])).toBe("en-GB");
    expect(speechLanguage("fr", ["de-DE", "fr-CA"])).toBe("fr-CA");
  });

  it("keeps a locale that names its region", () => {
    expect(speechLanguage("pt-BR", ["en-US"])).toBe("pt-BR");
  });

  it("falls back to a common region", () => {
    expect(speechLanguage("ja", ["en-US"])).toBe("ja-JP");
    expect(speechLanguage("es", [])).toBe("es-ES");
  });
});

/** A stand-in for the browser's recognition: tests hear and end it by hand. */
class FakeRecognition {
  static made: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = true;
  maxAlternatives = 0;
  processLocally = false;
  track: MediaStreamTrack | undefined;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  stopped: "stop" | "abort" | null = null;
  constructor() {
    FakeRecognition.made.push(this);
  }
  start(track?: MediaStreamTrack) {
    this.track = track;
  }
  stop() {
    this.stopped = "stop";
  }
  abort() {
    this.stopped = "abort";
  }
  hear(text: string, isFinal = true) {
    const result = Object.assign([{ transcript: text }], { isFinal });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
  fail(error: string) {
    this.onerror?.({ error });
    this.onend?.();
  }
}

describe("startTranscribing", () => {
  afterEach(() => {
    FakeRecognition.made = [];
    vi.useRealTimers();
  });
  const api = FakeRecognition as unknown as SpeechApi;
  const track = {} as MediaStreamTrack;

  it("listens on the device, to the given mic, and sends finished lines", () => {
    const lines: string[] = [];
    startTranscribing({
      api,
      lang: "en-US",
      track,
      onLine: (text) => lines.push(text),
      onFail: () => {},
    });
    const [recognition] = FakeRecognition.made;
    expect(recognition).toMatchObject({
      lang: "en-US",
      processLocally: true,
      continuous: true,
      interimResults: false,
      track,
    });
    recognition?.hear("  not yet", false);
    recognition?.hear(" Hello there ");
    expect(lines).toEqual(["Hello there"]);
  });

  it("starts again when the browser ends a recognition", () => {
    vi.useFakeTimers();
    startTranscribing({
      api,
      lang: "en-US",
      track,
      onLine: () => {},
      onFail: () => {},
    });
    FakeRecognition.made[0]?.fail("no-speech");
    vi.advanceTimersByTime(300);
    expect(FakeRecognition.made).toHaveLength(2);
  });

  it("gives up when the device refuses", () => {
    vi.useFakeTimers();
    const onFail = vi.fn();
    startTranscribing({ api, lang: "xx", track, onLine: () => {}, onFail });
    FakeRecognition.made[0]?.fail("language-not-supported");
    vi.advanceTimersByTime(5000);
    expect(onFail).toHaveBeenCalledWith("language-not-supported");
    expect(FakeRecognition.made).toHaveLength(1);
  });

  it("gives up after failing again and again", () => {
    vi.useFakeTimers();
    const onFail = vi.fn();
    startTranscribing({ api, lang: "en-US", track, onLine: () => {}, onFail });
    for (let i = 0; i < 6; i++) {
      FakeRecognition.made.at(-1)?.fail("audio-capture");
      vi.advanceTimersByTime(10_000);
    }
    expect(onFail).toHaveBeenCalledWith("repeated-errors");
  });

  it("finishes the last words on stop, or drops them", () => {
    const lines: string[] = [];
    const finishing = startTranscribing({
      api,
      lang: "en-US",
      track,
      onLine: (text) => lines.push(text),
      onFail: () => {},
    });
    finishing.stop("finish");
    expect(FakeRecognition.made[0]?.stopped).toBe("stop");

    const discarding = startTranscribing({
      api,
      lang: "en-US",
      track,
      onLine: (text) => lines.push(text),
      onFail: () => {},
    });
    discarding.stop("discard");
    const second = FakeRecognition.made[1];
    expect(second?.stopped).toBe("abort");
    second?.hear("late words");
    expect(lines).toEqual([]);
  });
});

describe("transcriptionStatus", () => {
  const on = { optedOut: false, failed: false } as const;

  it("puts someone in the notes once their browser is ready", () => {
    expect(transcriptionStatus({ ...on, support: "available" })).toBe("on");
  });

  it("says when the one-time download is still to do, or under way", () => {
    expect(transcriptionStatus({ ...on, support: "downloadable" })).toBe(
      "download",
    );
    expect(transcriptionStatus({ ...on, support: "downloading" })).toBe(
      "downloading",
    );
  });

  it("keeps can't for browsers that can't, or that stopped working", () => {
    expect(transcriptionStatus({ ...on, support: "unavailable" })).toBe(
      "unsupported",
    );
    expect(
      transcriptionStatus({ ...on, support: "available", failed: true }),
    ).toBe("unsupported");
  });

  it("puts choosing not to be transcribed first, and says nothing while checking", () => {
    expect(
      transcriptionStatus({ ...on, optedOut: true, support: "downloadable" }),
    ).toBe("optedOut");
    expect(transcriptionStatus({ ...on, support: "checking" })).toBeNull();
  });
});
