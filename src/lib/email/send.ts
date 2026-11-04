import "server-only";

import { waitUntil } from "@vercel/functions";
import { z } from "zod";

import { loggable } from "@/lib/log";
import { serverEnv } from "@/lib/server-env";
import { recordSentEmail } from "@/lib/usage/emails";

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Extra headers, such as List-Unsubscribe on reminder emails. */
  headers?: Record<string, string>;
};

const isDevelopment = process.env.NODE_ENV === "development";

/** Resend is set up: both the API key and a sender on a verified domain. */
function resendConfig(): { apiKey: string; from: string } | null {
  const { RESEND_API_KEY, EMAIL_FROM } = serverEnv();
  return RESEND_API_KEY && EMAIL_FROM
    ? { apiKey: RESEND_API_KEY, from: EMAIL_FROM }
    : null;
}

/**
 * Whether email sign-up and sign-in are offered. They need email delivery; development
 * always has it, because emails print to the server log there.
 */
export function emailPasswordEnabled(): boolean {
  return isDevelopment || resendConfig() !== null;
}

const RESEND_API = "https://api.resend.com";

/** Resend's answer to a new email: its ID. */
const Sent = z.object({ id: z.string().min(1).max(200) });

/**
 * Sends an email now, or at `scheduledAt` (Resend holds it until then; up to 30 days
 * ahead). `idempotencyKey` makes a retry return the email the first try made rather than a
 * second one. Gives Resend's ID for it; null in development, where emails print to the
 * server log instead.
 */
export async function sendEmail(
  email: Email,
  options: { scheduledAt?: Date; idempotencyKey?: string } = {},
): Promise<string | null> {
  const resend = resendConfig();
  if (!resend) {
    if (!isDevelopment) throw new Error("Email delivery isn't configured.");
    const when = options.scheduledAt
      ? `\n[email] Sends at: ${options.scheduledAt.toISOString()}`
      : "";
    console.info(
      `\n[email] To: ${email.to}${when}\n[email] Subject: ${email.subject}\n\n${email.text}\n`,
    );
    return null;
  }
  const response = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json",
      ...(options.idempotencyKey
        ? { "Idempotency-Key": options.idempotencyKey }
        : {}),
    },
    body: JSON.stringify({
      from: resend.from,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
      ...(email.headers ? { headers: email.headers } : {}),
      ...(options.scheduledAt
        ? { scheduled_at: options.scheduledAt.toISOString() }
        : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend refused an email (HTTP ${response.status}).`);
  }
  // Counted for Settings → Admin → Usage this month, on the day it goes, with the counts
  // Resend reports; a count that fails to save never fails the email.
  await recordSentEmail(response.headers, options.scheduledAt).catch(
    (error: unknown) => {
      console.error("Couldn't count a sent email", loggable(error));
    },
  );
  const sent = Sent.safeParse(await response.json().catch(() => null));
  return sent.success ? sent.data.id : null;
}

/** Where a scheduled email stands, as Resend reports it. */
const Status = z.object({ last_event: z.string().max(50).nullish() });

/**
 * Cancels a scheduled email: "cancelled" once it won't go (or Resend has no such email),
 * "sent" when it already went, or "retry" when Resend couldn't be asked, or the email is
 * so new that Resend hasn't finished scheduling it. Cancelling twice is fine.
 */
export async function cancelScheduledEmail(
  id: string,
): Promise<"cancelled" | "sent" | "retry"> {
  const resend = resendConfig();
  if (!resend) return isDevelopment ? "cancelled" : "retry";
  const headers = { Authorization: `Bearer ${resend.apiKey}` };
  const path = `${RESEND_API}/emails/${encodeURIComponent(id)}`;
  const response = await fetch(`${path}/cancel`, {
    method: "POST",
    headers,
  }).catch(() => null);
  if (response?.ok || response?.status === 404) return "cancelled";
  if (response?.status !== 422) return "retry";
  // "Email is not scheduled": it went already, or it's still being scheduled.
  const status = await fetch(path, { headers })
    .then((answer) => (answer.ok ? answer.json() : null))
    .catch(() => null);
  const event = Status.safeParse(status).data?.last_event ?? null;
  if (event === "canceled") return "cancelled";
  if (event === null || event === "scheduled" || event === "queued") {
    return "retry";
  }
  return "sent";
}

/**
 * Sends after the response, so how long a request takes never reveals whether an
 * account exists for an email. Failures are logged; the person can ask again.
 */
export function sendInBackground(email: Promise<Email>): void {
  waitUntil(
    email.then(sendEmail).catch((error: unknown) => {
      console.error("An account email failed to send", error);
    }),
  );
}
