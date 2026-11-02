import { describe, expect, it } from "vitest";

import { loggable } from "./log";

describe("loggable", () => {
  it("keeps only the database's error from a failed query", () => {
    const cause = Object.assign(new Error("relation does not exist"), {
      code: "42P01",
    });
    const failed = new Error(
      'Failed query: select * from "user" where "email" = $1\nparams: ada@example.com',
      { cause },
    );
    const logged = loggable(failed);
    expect(logged).toEqual({
      name: "Error",
      message: "relation does not exist",
      code: "42P01",
    });
    expect(JSON.stringify(logged)).not.toContain("ada@example.com");
  });

  it("leaves other errors as they are", () => {
    const error = new Error("Stream is down");
    expect(loggable(error)).toBe(error);
    expect(loggable("text")).toBe("text");
  });
});
