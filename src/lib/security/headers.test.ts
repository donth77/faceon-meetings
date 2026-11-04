import { describe, expect, it } from "vitest";

import config from "../../../next.config";

/** The headers next.config.ts sends on every page. */
async function everyPage(): Promise<Map<string, string>> {
  const headers = (await (await config()).headers?.()) ?? [];
  const all = headers.find((rule) => rule.source === "/:path*");
  return new Map(all?.headers.map((header) => [header.key, header.value]));
}

describe("the headers on every page", () => {
  it("keep browsers on HTTPS, subdomains included", async () => {
    expect((await everyPage()).get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains",
    );
  });

  it("enforce the rules that can't break a page while the full policy reports", async () => {
    const pages = await everyPage();
    expect(pages.get("Content-Security-Policy")).toBe(
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    );
    expect(pages.get("Content-Security-Policy-Report-Only")).toContain(
      "script-src",
    );
    expect(pages.get("X-Frame-Options")).toBe("DENY");
  });
});
