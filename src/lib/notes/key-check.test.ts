import { beforeEach, describe, expect, it, vi } from "vitest";

import { testKey } from "./engines";
import {
  checkKey,
  failedCheck,
  keyCheckOf,
  keyProblem,
  recheckKey,
} from "./key-check";
import { ProviderError } from "./providers";

vi.mock("./engines", () => ({ testKey: vi.fn() }));
const tested = vi.mocked(testKey);

const choice = (key: string) => ({
  provider: "openai" as const,
  model: "m",
  key,
});
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("checking an AI key", () => {
  beforeEach(() => tested.mockReset());

  it("asks the provider once per key, and says what it answered", async () => {
    tested.mockResolvedValue();
    checkKey(choice("works-1"));
    expect(keyCheckOf(choice("works-1"))).toEqual({ state: "testing" });
    checkKey(choice("works-1"));
    await settled();
    expect(keyCheckOf(choice("works-1"))).toEqual({ state: "works" });
    checkKey(choice("works-1"));
    expect(tested).toHaveBeenCalledTimes(1);
    expect(keyCheckOf(choice("never-asked"))).toBeNull();
  });

  it("keeps the provider's reason when it refuses, and Test key asks again", async () => {
    tested.mockImplementation(() =>
      Promise.reject(new ProviderError("key", "Incorrect API key.")),
    );
    checkKey(choice("refused-1"));
    await settled();
    expect(keyCheckOf(choice("refused-1"))).toEqual({
      state: "failed",
      failure: "key",
      detail: "Incorrect API key.",
    });

    tested.mockResolvedValue();
    recheckKey(choice("refused-1"));
    await settled();
    expect(keyCheckOf(choice("refused-1"))).toEqual({ state: "works" });
    expect(tested).toHaveBeenCalledTimes(2);
  });

  it("asks again only once a test has finished", async () => {
    tested.mockResolvedValue();
    checkKey(choice("busy-1"));
    recheckKey(choice("busy-1"));
    await settled();
    expect(tested).toHaveBeenCalledTimes(1);
  });
});

describe("failedCheck", () => {
  it("keeps a provider's failure and reason, and counts anything else as other", () => {
    expect(failedCheck(new ProviderError("limit", "Out of credit."))).toEqual({
      state: "failed",
      failure: "limit",
      detail: "Out of credit.",
    });
    expect(failedCheck(new TypeError("Failed to fetch"))).toEqual({
      state: "failed",
      failure: "other",
      detail: "",
    });
  });
});

describe("keyProblem", () => {
  it("is a refused key, model or account, not a connection that failed", () => {
    for (const failure of ["key", "model", "limit"] as const) {
      const check = { state: "failed" as const, failure, detail: "" };
      expect(keyProblem(check)).toBe(check);
    }
    for (const failure of ["unreachable", "other"] as const) {
      expect(keyProblem({ state: "failed", failure, detail: "" })).toBeNull();
    }
    expect(keyProblem({ state: "works" })).toBeNull();
    expect(keyProblem({ state: "testing" })).toBeNull();
    expect(keyProblem(null)).toBeNull();
  });
});
