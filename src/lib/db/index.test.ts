import { EventEmitter } from "node:events";
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

const closed = () => new Error("Connection terminated unexpectedly");

describe("the database pool", () => {
  it("survives the database closing a connection, idle or in use", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@example.test/app");
    const { db } = await import("./index");
    db();
    const pool = pools.at(-1);
    if (!pool) throw new Error("No pool was made.");
    // node-postgres reports it this way: an error event nobody hears is thrown.
    expect(() => pool.emit("error", closed())).not.toThrow();
    // A connection held for a transaction reports it on itself.
    const client = new EventEmitter();
    pool.emit("connect", client);
    expect(() => client.emit("error", closed())).not.toThrow();
  });
});
