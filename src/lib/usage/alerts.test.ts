import type { Locale } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { usageAlertEmail } from "./alerts";
import type { Alert } from "./meters";

// The email's words come from messages/en.json, as they would on the server.
vi.mock("next-intl/server", async () => {
  const { readFileSync } = await import("node:fs");
  const path = await import("node:path");
  const { createTranslator } = await import("next-intl");
  const messages = JSON.parse(
    readFileSync(path.join(process.cwd(), "messages", "en.json"), "utf8"),
  );
  return {
    getTranslations: async (options: { locale: Locale; namespace: string }) =>
      createTranslator({
        locale: options.locale,
        messages,
        namespace: options.namespace as never,
      }),
  };
});

const alert = (changes: Partial<Alert>): Alert => ({
  meter: "stream",
  period: "2026-11",
  used: 272_480.6,
  limit: 333_000,
  threshold: 80,
  covers: [],
  ...changes,
});

describe("usage warning emails", () => {
  it("says how much of Stream's minutes is used, and that 100% comes next", async () => {
    const email = await usageAlertEmail(alert({}), "admin@example.com", "en");
    expect(email.to).toBe("admin@example.com");
    expect(email.subject).toBe("FaceOn: Stream video minutes at 82%");
    expect(email.text).toContain("Stream video minutes are at 82%");
    expect(email.text).toContain(
      "FaceOn has used 272,481 of this month’s 333,000 participant-minutes on Stream",
    );
    expect(email.text).toContain("You’ll hear again if it reaches 100%.");
    expect(email.text).toContain("/settings/admin#usage");
    expect(email.html).toContain("/settings/admin#usage");
  });

  it("names the day for a day's emails, and says it's the last warning this month", async () => {
    const email = await usageAlertEmail(
      alert({
        meter: "emailsDay",
        used: 100,
        limit: 100,
        threshold: 100,
        covers: [80],
        day: "2026-11-03",
      }),
      "admin@example.com",
      "en",
    );
    expect(email.subject).toBe("FaceOn: a day’s emails at 100%");
    expect(email.text).toContain(
      "On November 3, FaceOn sent 100 of the 100 emails Resend allows in a day.",
    );
    expect(email.text).toContain(
      "That’s the last email about it until the next month.",
    );
  });

  it("speaks of Neon's billing period, in compute hours to a tenth", async () => {
    const email = await usageAlertEmail(
      alert({
        meter: "neon",
        period: "2026-11-01",
        used: 101.26,
        limit: 100,
        threshold: 100,
      }),
      "admin@example.com",
      "en",
    );
    expect(email.subject).toBe("FaceOn: database compute at 101%");
    expect(email.text).toContain(
      "The database has used 101.3 of its 100 compute hours this billing period.",
    );
    expect(email.text).toContain("until the next billing period.");
  });
});
