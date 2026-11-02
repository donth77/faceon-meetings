import { describe, expect, it } from "vitest";

import { authOrigins } from "./origins";

describe("authOrigins", () => {
  it("trusts only the production origin in production", () => {
    expect(
      authOrigins({
        productionUrl: "https://meetfaceon.vercel.app/",
        development: false,
      }),
    ).toEqual(["https://meetfaceon.vercel.app"]);
  });

  it("adds a deployment's own addresses, and nobody else's", () => {
    const origins = authOrigins({
      productionUrl: "https://meetfaceon.vercel.app",
      vercelUrl: "face-on-abc123-team.vercel.app",
      vercelBranchUrl: "face-on-git-fix-team.vercel.app",
      development: false,
    });
    expect(origins).toEqual([
      "https://meetfaceon.vercel.app",
      "https://face-on-abc123-team.vercel.app",
      "https://face-on-git-fix-team.vercel.app",
    ]);
    expect(origins.some((origin) => origin.includes("*"))).toBe(false);
  });

  it("adds localhost only in development", () => {
    expect(
      authOrigins({
        productionUrl: "http://localhost:3000",
        development: true,
      }),
    ).toEqual(["http://localhost:3000"]);
    expect(
      authOrigins({
        productionUrl: "https://faceon.example.com",
        development: false,
      }),
    ).not.toContain("http://localhost:3000");
  });
});
