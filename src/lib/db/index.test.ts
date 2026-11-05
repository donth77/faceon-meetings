import type { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const pools = vi.hoisted(() => [] as EventEmitter[]);
vi.mock("pg", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    Pool: class extends EventEmitter {
      constructor() {
        super();
        pools.push(this);
      }
    },
  };
});
vi.mock("@vercel/functions", () => ({ attachDatabasePool: vi.fn() }));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({}) }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the database pool", () => {
  it("lets go of an idle connection the database closed, without crashing", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@example.test/app");
    const { db } = await import("./index");
    db();
    const pool = pools.at(-1);
    expect(pool).toBeDefined();
    // node-postgres reports it this way; an error event nobody hears is thrown.
    expect(() =>
      pool?.emit("error", new Error("Connection terminated unexpectedly")),
    ).not.toThrow();
  });
});
