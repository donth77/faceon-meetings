import { describe, expect, it } from "vitest";

import { deviceProblem } from "./problems";

const domError = (name: string) =>
  Object.assign(new Error(name), { name }) as Error;

describe("deviceProblem", () => {
  it("maps getUserMedia errors to the help we show", () => {
    expect(deviceProblem(domError("NotAllowedError"))).toBe("blocked");
    expect(deviceProblem(domError("NotFoundError"))).toBe("notFound");
    expect(deviceProblem(domError("NotReadableError"))).toBe("inUse");
    expect(deviceProblem(domError("OverconstrainedError"))).toBe(
      "unavailableSetting",
    );
  });

  it("says so where the browser can't use cameras and microphones at all", () => {
    expect(deviceProblem(new TypeError("no getUserMedia"), false)).toBe(
      "unsupported",
    );
  });

  it("falls back to unknown", () => {
    expect(deviceProblem(new TypeError("boom"))).toBe("unknown");
    expect(deviceProblem("nope")).toBe("unknown");
  });
});
