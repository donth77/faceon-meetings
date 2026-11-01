/**
 * Checks that both database connections work: the pooled one the app uses and the direct
 * one migrations use. Usage: node --env-file=.env.local scripts/db-check.ts
 */
import pg from "pg";

const targets = {
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
};

let failed = 0;
for (const [name, connectionString] of Object.entries(targets)) {
  if (!connectionString) {
    console.log(`FAIL  ${name} is not set`);
    failed++;
    continue;
  }
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const { rows } = await client.query<{ version: string }>(
      "select version()",
    );
    console.log(
      `OK    ${name}: ${rows[0]?.version.split(" ").slice(0, 2).join(" ")}`,
    );
  } catch (error) {
    console.log(`FAIL  ${name}: ${(error as Error).message}`);
    failed++;
  } finally {
    await client.end().catch(() => undefined);
  }
}
process.exit(failed ? 1 : 0);
