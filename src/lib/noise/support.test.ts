import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Each test gets the module fresh: it remembers a failure for the rest of the visit.
const load = () => import("./support");

describe("strong noise suppression's availability", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isn't available on the server", async () => {
    const { strongAvailable } = await load();
    expect(strongAvailable()).toBe(false);
  });

  it("is available with an AudioWorklet and WebAssembly on a secure page", async () => {
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("AudioWorkletNode", function AudioWorkletNode() {});
    const { strongAvailable } = await load();
    expect(strongAvailable()).toBe(true);
  });

  it("isn't available without an AudioWorklet", async () => {
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("AudioWorkletNode", undefined);
    const { strongAvailable } = await load();
    expect(strongAvailable()).toBe(false);
  });

  it("stops being available after a failure, says so once, and tells listeners once", async () => {
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("AudioWorkletNode", function AudioWorkletNode() {});
    const {
      strongAvailable,
      strongFailed,
      subscribeStrong,
      takeFailureNotice,
    } = await load();
    const listener = vi.fn();
    subscribeStrong(listener);
    expect(takeFailureNotice()).toBe(false);
    strongFailed();
    strongFailed();
    expect(strongAvailable()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(takeFailureNotice()).toBe(true);
    expect(takeFailureNotice()).toBe(false);
  });
});
