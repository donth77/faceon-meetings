import { createHmac, randomBytes, randomInt } from "node:crypto";
import { Pool } from "pg";

import {
  DEFAULT_SETTINGS,
  type MeetingSettings,
} from "@/lib/meetings/settings";

import { authSecret, isLocalDatabase, testDatabaseUrl } from "./env";

let pool: Pool | undefined;

/** The tests' own connection to the app's database, for setting up and cleaning up. */
export function database(): Pool {
  pool ??= new Pool({
    // As the app does: Neon's sslmode=require means verify-full to node-postgres.
    connectionString: testDatabaseUrl().replace(
      "sslmode=require",
      "sslmode=verify-full",
    ),
    max: 4,
  });
  return pool;
}

export type TestUser = {
  id: string;
  name: string;
  email: string;
  /** The signed session cookie that signs this user in. */
  cookie: { name: string; value: string };
};

/** A random hex string, for IDs nobody else's test will pick. */
const unique = (bytes = 6) => randomBytes(bytes).toString("hex");

/**
 * A verified account with a session, signed in through its cookie (the way Better Auth
 * signs it), so tests skip the sign-in screens they don't test. `signedInAgo` makes an
 * older sign-in, which deleting the account refuses.
 */
export async function createUser(
  options: {
    name?: string;
    aiNotes?: boolean;
    signedInAgo?: string;
    /** Has signed in to the desktop app already. */
    usedDesktopApp?: boolean;
    /**
     * A particular address, such as the test admin's (ADMIN_EMAIL). Any account left
     * with it from an earlier run is deleted first.
     */
    email?: string;
  } = {},
): Promise<TestUser> {
  const id = `e2e_${unique()}`;
  const name = options.name ?? "Test Host";
  const email = options.email ?? `${id}@faceon.test`;
  if (options.email) {
    const left = await database().query<{ id: string }>(
      `select id from "user" where lower(email) = lower($1)`,
      [options.email],
    );
    await deleteUsers(left.rows.map((row) => row.id));
  }
  await database().query(
    `insert into "user" (id, name, email, email_verified, avatar_seed, avatar_source, ai_notes, desktop_app_at, created_at, updated_at)
     values ($1, $2, $3, true, $4, 'dicebear', $5, case when $6::boolean then now() end, now(), now())`,
    [
      id,
      name,
      email,
      `${unique(8)}-f`,
      options.aiNotes ?? false,
      options.usedDesktopApp ?? false,
    ],
  );
  const token = randomBytes(24).toString("base64url");
  await database().query(
    `insert into session (id, token, user_id, expires_at, created_at, updated_at)
     values ($1, $2, $3, now() + interval '2 hours', now() - $4::interval, now())`,
    [unique(12), token, id, options.signedInAgo ?? "0 minutes"],
  );
  const signature = createHmac("sha256", authSecret())
    .update(token)
    .digest("base64");
  return {
    id,
    name,
    email,
    cookie: {
      name: "better-auth.session_token",
      value: encodeURIComponent(`${token}.${signature}`),
    },
  };
}

/** Deletes test users with everything they host (the database cascades the rest). */
export async function deleteUsers(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await database().query(`delete from meeting where host_id = any($1)`, [ids]);
  await database().query(`delete from "user" where id = any($1)`, [ids]);
}

export type TestMeeting = { id: string; code: string; passcode: string };

/** A 10-digit meeting ID no other meeting has (it starts at 1, like the app's). */
const meetingCode = () => String(randomInt(1_000_000_000, 9_999_999_999));

/** An instant meeting the host can start, with a passcode and the given settings. */
export async function createMeeting(
  hostId: string,
  settings: Partial<MeetingSettings> = {},
): Promise<TestMeeting> {
  const code = meetingCode();
  const passcode = "K7XQ2M";
  const { rows } = await database().query<{ id: string }>(
    `insert into meeting (code, host_id, type, passcode, settings, expires_at)
     values ($1, $2, 'instant', $3, $4, now() + interval '1 day') returning id`,
    [
      code,
      hostId,
      passcode,
      JSON.stringify({ ...DEFAULT_SETTINGS.instant, ...settings }),
    ],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("The test meeting wasn't created.");
  return { id, code, passcode };
}

/**
 * A one-off scheduled meeting that lasts an hour, with `invitees` invited by email, as the
 * schedule form does. It's on now (it started a minute ago) unless `startsInMinutes`
 * says when it starts.
 */
export async function createScheduledMeeting(
  hostId: string,
  options: { title: string; invitees?: string[]; startsInMinutes?: number },
): Promise<TestMeeting> {
  const code = meetingCode();
  const passcode = "K7XQ2M";
  const { rows } = await database().query<{ id: string }>(
    `insert into meeting (code, host_id, type, title, passcode, settings, starts_at, duration_min, time_zone, expires_at)
     values ($1, $2, 'scheduled', $3, $4, $5, now() + make_interval(mins => $6), 60, 'America/New_York', now() + interval '1 day') returning id`,
    [
      code,
      hostId,
      options.title,
      passcode,
      JSON.stringify(DEFAULT_SETTINGS.scheduled),
      options.startsInMinutes ?? -1,
    ],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("The test meeting wasn't created.");
  for (const email of options.invitees ?? []) {
    await database().query(
      `insert into meeting_invitee (meeting_id, email) values ($1, $2)`,
      [id, email.toLowerCase()],
    );
  }
  return { id, code, passcode };
}

/**
 * A meeting that already happened, for Previous: an ended session with the host and a
 * guest in it, `minutes` long, ending an hour ago.
 */
export async function createPastMeeting(
  host: TestUser,
  options: { minutes: number; guestName: string },
): Promise<TestMeeting> {
  const meeting = await createMeeting(host.id);
  const ended = new Date(Date.now() - 60 * 60_000);
  const started = new Date(ended.getTime() - options.minutes * 60_000);
  const { rows } = await database().query<{ id: string }>(
    `insert into meeting_session (meeting_id, provider, status, limits, started_at, ended_at, last_seen_at)
     values ($1, 'stream', 'ended', $2, $3, $4, $4) returning id`,
    [
      meeting.id,
      JSON.stringify({
        maxParticipants: 4,
        maxDurationSeconds: 900,
        demo: true,
      }),
      started,
      ended,
    ],
  );
  const sessionId = rows[0]?.id;
  if (!sessionId) throw new Error("The test session wasn't created.");
  const people = [
    { mediaUserId: `u_${host.id}`, userId: host.id, name: host.name },
    { mediaUserId: `g_${unique()}`, userId: null, name: options.guestName },
  ];
  for (const person of people) {
    await database().query(
      `insert into participant_session (session_id, connection_id, media_user_id, user_id, display_name, joined_at, left_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        `e2e-${unique()}`,
        person.mediaUserId,
        person.userId,
        person.name,
        started,
        ended,
      ],
    );
  }
  return meeting;
}

/** The session of a meeting made with createPastMeeting. */
export async function sessionOf(meetingId: string): Promise<string> {
  const { rows } = await database().query<{ id: string }>(
    `select id from meeting_session where meeting_id = $1`,
    [meetingId],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("The test session wasn't found.");
  return id;
}

/**
 * Forgets the failed-attempt counters (wrong passcodes, unknown meeting IDs), which every
 * test from this machine shares. Only on a database that's here to be thrown away.
 */
export async function resetAttempts(): Promise<void> {
  if (!isLocalDatabase()) return;
  await database().query(`delete from attempt_counter`);
}

/** Whether an account still exists. */
/** Whether an account is noted as using the desktop app. */
export async function usesDesktopApp(id: string): Promise<boolean> {
  const { rows } = await database().query<{ used: boolean }>(
    `select desktop_app_at is not null as used from "user" where id = $1`,
    [id],
  );
  return rows[0]?.used ?? false;
}

export async function userExists(id: string): Promise<boolean> {
  const { rows } = await database().query(
    `select 1 from "user" where id = $1`,
    [id],
  );
  return rows.length > 0;
}

/** An account's requests to host full meetings, newest first. */
export async function hostingRequests(
  userId: string,
): Promise<Array<{ status: string; note: string | null }>> {
  const { rows } = await database().query<{
    status: string;
    note: string | null;
  }>(
    `select status, note from hosting_request where user_id = $1 order by created_at desc`,
    [userId],
  );
  return rows;
}

/** Closes the connection when a worker is done. */
export async function closeDatabase(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
