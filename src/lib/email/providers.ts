import "server-only";

import { serverEnv } from "@/lib/server-env";
import { z } from "@/lib/zod";

/**
 * The services that send FaceOn's emails, each behind the same small interface, so
 * send.ts can try the next when one can't. Resend comes first; Mailtrap, when it's set
 * up, is the backup. Another (Brevo, SMTP through a relay) is one more Provider here.
 */

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Extra headers, such as List-Unsubscribe on reminder emails. */
  headers?: Record<string, string>;
};

export type SendOptions = {
  /** Hold it until then (a reminder), with a provider that can. */
  scheduledAt?: Date;
  /** Makes a retry return the email the first try made rather than a second one. */
  idempotencyKey?: string;
};

/**
 * Why a provider didn't send: a limit reached ("quota"), the service failing or out of
 * reach ("unavailable"), or the email or the setup turned down ("refused").
 */
export type Failure = "quota" | "unavailable" | "refused";

export type Outcome =
  | { ok: true; id: string | null; headers: Headers }
  | { ok: false; failure: Failure; status: number | null };

export type Provider = {
  id: "resend" | "mailtrap";
  /** Its name in errors. */
  name: string;
  /** Whether it can hold an email until a set time, as reminders need. */
  schedules: boolean;
  /** Gives its ID for the email; throws when the service can't be reached. */
  send(email: Email, options: SendOptions): Promise<Outcome>;
};

/** What a provider's refusal means, by its HTTP status. */
export function failureOf(status: number): Failure {
  if (status === 429) return "quota";
  if (status >= 500) return "unavailable";
  return "refused";
}

/**
 * Whether the next provider is worth trying: after a limit or an outage, yes; after a
 * refusal, no, since a bad address or a broken setup is for someone to see and fix.
 */
export const shouldFallBack = (failure: Failure) => failure !== "refused";

/** A sender as an address and a name: "FaceOn <no-reply@example.com>", or the bare address. */
export function mailbox(from: string): { email: string; name?: string } {
  const named = /^(.*)<([^<>]+)>$/.exec(from.trim());
  if (!named) return { email: from.trim() };
  const email = (named[2] ?? "").trim();
  const name = (named[1] ?? "").trim().replace(/^"(.*)"$/, "$1");
  return name ? { email, name } : { email };
}

/** How long a provider has to answer before the next is tried. */
const SEND_TIMEOUT_MS = 10_000;

/** Posts an email to a provider's API: its ID for it, or why it didn't take it. */
async function post(
  url: string,
  apiKey: string,
  body: object,
  idOf: (answer: unknown) => string | null,
  headers: Record<string, string> = {},
): Promise<Outcome> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    return {
      ok: false,
      failure: failureOf(response.status),
      status: response.status,
    };
  }
  const answer: unknown = await response.json().catch(() => null);
  return { ok: true, id: idOf(answer), headers: response.headers };
}

export const RESEND_API = "https://api.resend.com";

/** Resend is set up: both the API key and a sender on a verified domain. */
export function resendConfig(): { apiKey: string; from: string } | null {
  const { RESEND_API_KEY, EMAIL_FROM } = serverEnv();
  return RESEND_API_KEY && EMAIL_FROM
    ? { apiKey: RESEND_API_KEY, from: EMAIL_FROM }
    : null;
}

/** Resend's answer to a new email: its ID. */
const ResendSent = z.object({ id: z.string().min(1).max(200) });

/** Resend: first to try, and the one that schedules (up to 30 days ahead). */
function resend(apiKey: string, from: string): Provider {
  return {
    id: "resend",
    name: "Resend",
    schedules: true,
    send: (email, options) =>
      post(
        `${RESEND_API}/emails`,
        apiKey,
        {
          from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          html: email.html,
          ...(email.headers ? { headers: email.headers } : {}),
          ...(options.scheduledAt
            ? { scheduled_at: options.scheduledAt.toISOString() }
            : {}),
        },
        (answer) => ResendSent.safeParse(answer).data?.id ?? null,
        options.idempotencyKey
          ? { "Idempotency-Key": options.idempotencyKey }
          : {},
      ),
  };
}

/** Mailtrap's answer to a new email: an ID for each recipient. */
const MailtrapSent = z.object({
  message_ids: z.array(z.string().min(1).max(200)).min(1),
});

/** Mailtrap's Email Sending API: the backup for emails that go now. It can't schedule. */
function mailtrap(apiKey: string, from: string): Provider {
  return {
    id: "mailtrap",
    name: "Mailtrap",
    schedules: false,
    send: (email) =>
      post(
        "https://send.api.mailtrap.io/api/send",
        apiKey,
        {
          from: mailbox(from),
          to: [{ email: email.to }],
          subject: email.subject,
          text: email.text,
          html: email.html,
          ...(email.headers ? { headers: email.headers } : {}),
        },
        (answer) => MailtrapSent.safeParse(answer).data?.message_ids[0] ?? null,
      ),
  };
}

/**
 * The providers set up here, in the order to try them: Resend (RESEND_API_KEY and
 * EMAIL_FROM), then Mailtrap (MAILTRAP_API_KEY, sending as MAILTRAP_FROM or EMAIL_FROM).
 */
export function emailProviders(): Provider[] {
  const env = serverEnv();
  const providers: Provider[] = [];
  const primary = resendConfig();
  if (primary) providers.push(resend(primary.apiKey, primary.from));
  const mailtrapFrom = env.MAILTRAP_FROM ?? env.EMAIL_FROM;
  if (env.MAILTRAP_API_KEY && mailtrapFrom) {
    providers.push(mailtrap(env.MAILTRAP_API_KEY, mailtrapFrom));
  }
  return providers;
}
