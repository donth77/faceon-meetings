import { afterEach, describe, expect, it, vi } from "vitest";

/** env.ts, read afresh as a build with these settings reads it. */
async function load(settings: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(settings)) {
    vi.stubEnv(name, value);
  }
  return import("./env");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("NEXT_PUBLIC_VERCEL_ANALYTICS", () => {
  it("counts page views when it's 1, in a production build", async () => {
    const env = await load({
      NEXT_PUBLIC_VERCEL_ANALYTICS: "1",
      NODE_ENV: "production",
    });
    expect(env.publicEnv.NEXT_PUBLIC_VERCEL_ANALYTICS).toBe("1");
    expect(env.vercelAnalyticsEnabled).toBe(true);
  });

  it("never counts them in development, which has no /_vercel/insights", async () => {
    const env = await load({
      NEXT_PUBLIC_VERCEL_ANALYTICS: "1",
      NODE_ENV: "development",
    });
    expect(env.vercelAnalyticsEnabled).toBe(false);
  });

  it("is off when it's 0, blank or unset", async () => {
    for (const value of ["0", "", undefined]) {
      const env = await load({
        NEXT_PUBLIC_VERCEL_ANALYTICS: value,
        NODE_ENV: "production",
      });
      expect(env.publicEnv.NEXT_PUBLIC_VERCEL_ANALYTICS, String(value)).toBe(
        "0",
      );
      expect(env.vercelAnalyticsEnabled, String(value)).toBe(false);
    }
  });

  it("refuses anything else", async () => {
    for (const value of ["true", "on", "yes"]) {
      await expect(
        load({ NEXT_PUBLIC_VERCEL_ANALYTICS: value }),
        value,
      ).rejects.toThrow("NEXT_PUBLIC_VERCEL_ANALYTICS must be 1 or 0.");
    }
  });
});
