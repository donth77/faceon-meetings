import type { Locale } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { permissionsEmail } from "./permissions";

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

describe("the permissions warning email", () => {
  it("names the service and the command that puts it back, linking to Settings → Admin", async () => {
    const email = await permissionsEmail(
      "stream",
      "pnpm stream:setup",
      "admin@example.com",
      "en",
    );
    expect(email.to).toBe("admin@example.com");
    expect(email.subject).toBe("FaceOn: Stream’s call permissions changed");
    expect(email.text).toContain("Stream’s call permissions changed");
    // What it is and why it matters, in plain words.
    expect(email.text).toContain(
      "host controls, like muting others or ending the meeting, only work through FaceOn",
    );
    expect(email.text).toContain(
      "To set them back, run pnpm stream:setup in your copy of FaceOn’s code, with this site’s Stream keys in .env.local.",
    );
    expect(email.text).toContain("You’re getting this because you’re an admin");
    expect(email.text).toContain("/settings/admin#permissions");
    expect(email.html).toContain("/settings/admin#permissions");
  });
});
