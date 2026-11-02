import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Settings for the browser tests. Locally, `.env.local` fills in whatever the shell
 * doesn't set, as it does for `pnpm dev`; CI sets everything in the workflow.
 */
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** The port the production build is served on for the tests. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);

/** Where the app under test runs: the server Playwright starts, unless E2E_BASE_URL says. */
export const BASE_URL =
  process.env.E2E_BASE_URL ?? `http://localhost:${E2E_PORT}`;

/** The database the tests write their own users and meetings to. */
export function testDatabaseUrl(): string {
  const url =
    process.env.E2E_DATABASE_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Set E2E_DATABASE_URL (or DATABASE_URL) to the database the app under test uses.",
    );
  }
  return url;
}

/** Signs the test users' session cookies; the app under test must use the same one. */
export function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Set BETTER_AUTH_SECRET for the browser tests.");
  return secret;
}

/** Whether the media tests can run: they join real calls on Stream's development app. */
export const hasStream = Boolean(
  process.env.NEXT_PUBLIC_STREAM_API_KEY && process.env.STREAM_API_SECRET,
);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** A database's host and name, the same for its pooled and direct addresses. */
function databaseIdentity(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace("-pooler.", ".")}${parsed.pathname}`;
  } catch {
    return null;
  }
}

/** Whether the tests' database is on this machine (CI's Postgres container, say). */
export function isLocalDatabase(url = testDatabaseUrl()): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * The tests create and delete users, so they refuse to run against production: never
 * on a Vercel production build, never against the database `.env.production.local`
 * names, and against any database off this machine only with E2E_ALLOW_REMOTE_DATABASE=1
 * (a development database, say). Nothing here prints a connection string.
 */
export function assertTestDatabase(): void {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("The browser tests never run on a production deployment.");
  }
  const url = testDatabaseUrl();
  const identity = databaseIdentity(url);
  const productionFile = path.resolve(".env.production.local");
  if (identity && existsSync(productionFile)) {
    const production = readFileSync(productionFile, "utf8")
      .split(/\r?\n/)
      .map((line) => /^\s*DATABASE_URL(?:_UNPOOLED)?\s*=\s*(.+)$/.exec(line))
      .flatMap((match) =>
        match?.[1] ? [match[1].trim().replace(/^["']|["']$/g, "")] : [],
      );
    if (production.some((value) => databaseIdentity(value) === identity)) {
      throw new Error(
        "The browser tests' database is the production database. Point E2E_DATABASE_URL somewhere else.",
      );
    }
  }
  if (!isLocalDatabase(url) && process.env.E2E_ALLOW_REMOTE_DATABASE !== "1") {
    throw new Error(
      "The browser tests write test users to the database. Use a local or throwaway database, or set E2E_ALLOW_REMOTE_DATABASE=1 for a development database (never production).",
    );
  }
}
