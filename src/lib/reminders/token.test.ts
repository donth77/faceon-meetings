import { describe, expect, it } from "vitest";

import { readUnsubscribeToken, unsubscribeToken } from "./token";

const SECRET = "test-secret-for-reminder-links";

describe("the unsubscribe link's token", () => {
  it("says whose reminders to turn off", () => {
    const token = unsubscribeToken("user_123", SECRET);
    expect(readUnsubscribeToken(token, SECRET)).toBe("user_123");
  });

  it("can't be made or changed without the secret", () => {
    const token = unsubscribeToken("user_123", SECRET);
    expect(readUnsubscribeToken(token, "another-secret")).toBeNull();
    const [payload] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ p: "email-reminders-off", u: "someone_else" }),
    ).toString("base64url");
    expect(
      readUnsubscribeToken(`${forged}.${token.split(".")[1]}`, SECRET),
    ).toBeNull();
    expect(readUnsubscribeToken(`${payload}.`, SECRET)).toBeNull();
  });

  it("refuses anything that isn't a token", () => {
    for (const value of [undefined, null, 42, "", "a.b.c", "x".repeat(600)]) {
      expect(readUnsubscribeToken(value, SECRET)).toBeNull();
    }
  });
});
