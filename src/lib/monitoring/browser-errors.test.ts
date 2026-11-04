import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A fresh copy of the module, with nothing waiting and reports not started. */
async function load() {
  vi.resetModules();
  return import("./browser-errors");
}

beforeEach(() => {
  vi.stubEnv(
    "NEXT_PUBLIC_SENTRY_DSN",
    "https://key@example.ingest.sentry.io/1",
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("browser errors", () => {
  it("hold errors from before reports start, then send them in order", async () => {
    const { reportBrowserError, startSendingBrowserErrors } = await load();
    const first = new Error("first");
    const second = new Error("second");
    reportBrowserError(first);
    reportBrowserError(second);

    const sender = vi.fn();
    startSendingBrowserErrors(sender);
    expect(sender.mock.calls).toEqual([[first], [second]]);
  });

  it("send at once after reports start", async () => {
    const { reportBrowserError, startSendingBrowserErrors } = await load();
    const sender = vi.fn();
    startSendingBrowserErrors(sender);
    const error = new Error("later");
    reportBrowserError(error);
    expect(sender).toHaveBeenCalledWith(error);
  });

  it("keep only a few while waiting", async () => {
    const { reportBrowserError, startSendingBrowserErrors } = await load();
    for (let i = 0; i < 25; i++) reportBrowserError(new Error(`error ${i}`));
    const sender = vi.fn();
    startSendingBrowserErrors(sender);
    expect(sender).toHaveBeenCalledTimes(10);
  });

  it("keep nothing without a DSN", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const { reportBrowserError, startSendingBrowserErrors } = await load();
    reportBrowserError(new Error("unseen"));
    const sender = vi.fn();
    startSendingBrowserErrors(sender);
    expect(sender).not.toHaveBeenCalled();
  });
});
