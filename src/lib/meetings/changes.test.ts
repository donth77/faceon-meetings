import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { announceMeetingsChanged, subscribeMeetingsChanged } from "./changes";

describe("meetings changed", () => {
  beforeEach(() => {
    vi.stubGlobal("window", new EventTarget());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reaches subscribers in this tab", () => {
    const onChange = vi.fn();
    const stop = subscribeMeetingsChanged(onChange);
    announceMeetingsChanged();
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    announceMeetingsChanged();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reaches this tab once, not again through the channel", async () => {
    const onChange = vi.fn();
    const stop = subscribeMeetingsChanged(onChange);
    announceMeetingsChanged();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });

  it("reaches other tabs through the browser's channel", async () => {
    const onChange = vi.fn();
    // Another tab's subscription: its own channel, which this tab's message reaches.
    const other = new BroadcastChannel("faceon.meetings");
    other.onmessage = onChange;
    announceMeetingsChanged();
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    other.close();
  });
});
