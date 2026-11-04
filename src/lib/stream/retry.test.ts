import { StreamError } from "@stream-io/node-sdk";
import { describe, expect, it, vi } from "vitest";

import { droppedBeforeAnswer, resentIfDropped } from "./retry";

/** The SDK's errors, as it throws them. */
const dropped = () =>
  new StreamError(
    "The request failed due to an unexpected error",
    { clientRequestId: "a" },
    undefined,
    { cause: new TypeError("fetch failed") },
  );
const timedOut = () =>
  new StreamError(
    "The request was aborted due to to the 3000ms timeout",
    { clientRequestId: "b" },
    undefined,
    { cause: new DOMException("The operation timed out.", "TimeoutError") },
  );
const answered = () =>
  new StreamError(
    "Stream error code 5: GetCall failed",
    { clientRequestId: "c", responseCode: 500 },
    5,
  );

const noWait = () => Promise.resolve();

describe("droppedBeforeAnswer", () => {
  it("is only a connection that failed before Stream answered", () => {
    expect(droppedBeforeAnswer(dropped())).toBe(true);
    expect(droppedBeforeAnswer(timedOut())).toBe(false);
    expect(droppedBeforeAnswer(answered())).toBe(false);
    expect(droppedBeforeAnswer(new TypeError("fetch failed"))).toBe(false);
  });
});

describe("resentIfDropped", () => {
  it("sends a request once when it goes through", async () => {
    const request = vi.fn().mockResolvedValue("ok");
    await expect(resentIfDropped(request, noWait)).resolves.toBe("ok");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("sends it once more, after a pause, when the connection dropped", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(dropped())
      .mockResolvedValue("ok");
    const wait = vi.fn(noWait);
    await expect(resentIfDropped(request, wait)).resolves.toBe("ok");
    expect(request).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it("gives up after that one more time", async () => {
    const second = dropped();
    const request = vi
      .fn()
      .mockRejectedValueOnce(dropped())
      .mockRejectedValue(second);
    await expect(resentIfDropped(request, noWait)).rejects.toBe(second);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("never sends again after an answer or a timeout", async () => {
    for (const error of [answered(), timedOut()]) {
      const request = vi.fn().mockRejectedValue(error);
      await expect(resentIfDropped(request, noWait)).rejects.toBe(error);
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
});
