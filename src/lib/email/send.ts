import "server-only";

import { waitUntil } from "@vercel/functions";

import { reportError } from "@/lib/monitoring/report";
import {
  recordMailtrapEmail,
  recordSentEmail,
  resendSpent,
} from "@/lib/usage/emails";
import { z } from "@/lib/zod";

import {
  emailProviders,
  RESEND_API,
  resendConfig,
  shouldFallBack,
  type Email,
  type Outcome,
  type Provider,
  type SendOptions,
} from "./providers";

export type { Email } from "./providers";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Whether emails can go: a provider is set up, or this is development, where emails
 * print to the server log instead.
 */
export function canSendEmail(): boolean {
  return isDevelopment || emailProviders().length > 0;
}

/** Whether emails can be held until a set time, as reminders are: Resend can, Mailtrap can't. */
export function canScheduleEmail(): boolean {
  return (
    isDevelopment || emailProviders().some((provider) => provider.schedules)
  );
}

/** Whether email sign-up and sign-in are offered. They need email delivery. */
export function emailPasswordEnabled(): boolean {
  return canSendEmail();
}

/**
 * The providers to try, in two rounds. An email with a time goes only to those that can
 * schedule it. One that goes now tries Resend last once the counts say its free allowance
 * is used up, today's or the month's, so a full day doesn't cost a refusal per email;
 * that last round is tried whatever happened before, since the counts can be behind (a
 * bigger plan, say).
 */
async function roundsFor(
  options: SendOptions,
): Promise<[Provider[], Provider[]]> {
  const providers = emailProviders().filter(
    (provider) => provider.schedules || !options.scheduledAt,
  );
  const resend = providers.filter((provider) => provider.id === "resend");
  const others = providers.filter((provider) => provider.id !== "resend");
  if (resend.length === 0 || others.length === 0) return [providers, []];
  const spent = await resendSpent().catch((error: unknown) => {
    reportError("Couldn't read the email counts", error);
    return false;
  });
  return spent ? [others, resend] : [providers, []];
}

type Attempt = { provider: Provider; outcome: Outcome & { ok: false } };

/** A provider that couldn't be reached: offline, or too slow to answer. */
const UNREACHABLE: Attempt["outcome"] = {
  ok: false,
  failure: "unavailable",
  status: null,
};

/**
 * Tries each provider in turn until one takes the email, moving on past a limit or an
 * outage but not a refusal. Notes every failure in `failed`.
 */
async function firstToSend(
  providers: readonly Provider[],
  email: Email,
  options: SendOptions,
  failed: Attempt[],
): Promise<{ provider: Provider; id: string | null; headers: Headers } | null> {
  for (const provider of providers) {
    const outcome = await provider
      .send(email, options)
      .catch(() => UNREACHABLE);
    if (outcome.ok) {
      return { provider, id: outcome.id, headers: outcome.headers };
    }
    failed.push({ provider, outcome });
    if (!shouldFallBack(outcome.failure)) break;
  }
  return null;
}

/** "Resend refused it (HTTP 429)", or "Mailtrap couldn't be reached". */
const described = ({ provider, outcome }: Attempt) =>
  outcome.status === null
    ? `${provider.name} couldn't be reached`
    : `${provider.name} refused it (HTTP ${outcome.status})`;

/**
 * Sends an email now, or at `scheduledAt` (Resend holds it until then; up to 30 days
 * ahead), with the first provider that takes it: Resend, or Mailtrap when Resend is at
 * its limit or down (roundsFor). `idempotencyKey` makes a retry return the email the
 * first try made rather than a second one. Gives the provider's ID for it; null in
 * development without a provider, where emails print to the server log instead.
 */
export async function sendEmail(
  email: Email,
  options: SendOptions = {},
): Promise<string | null> {
  const [first, last] = await roundsFor(options);
  if (first.length === 0 && last.length === 0) {
    if (!isDevelopment) {
      throw new Error(
        options.scheduledAt
          ? "No email provider set up here can schedule an email."
          : "Email delivery isn't configured.",
      );
    }
    const when = options.scheduledAt
      ? `\n[email] Sends at: ${options.scheduledAt.toISOString()}`
      : "";
    console.info(
      `\n[email] To: ${email.to}${when}\n[email] Subject: ${email.subject}\n\n${email.text}\n`,
    );
    return null;
  }
  const failed: Attempt[] = [];
  const sent =
    (await firstToSend(first, email, options, failed)) ??
    (await firstToSend(last, email, options, failed));
  if (!sent) {
    throw new Error(
      `An email couldn't be sent: ${failed.map(described).join("; ")}.`,
    );
  }
  for (const attempt of failed) {
    // A limit is expected (the usage meter warns about it); an outage or a refusal isn't.
    if (attempt.outcome.failure === "quota") {
      console.warn(
        `[email] ${described(attempt)}; ${sent.provider.name} sent it.`,
      );
    } else {
      reportError(
        "An email provider failed, so another sent the email",
        undefined,
        {
          provider: attempt.provider.id,
          status: attempt.outcome.status ?? "unreachable",
        },
      );
    }
  }
  // Counted for Settings → Admin → Usage this month, by provider, on the day it goes
  // (with the counts Resend reports); a count that fails to save never fails the email.
  await (
    sent.provider.id === "resend"
      ? recordSentEmail(sent.headers, options.scheduledAt)
      : recordMailtrapEmail()
  ).catch((error: unknown) => {
    reportError("Couldn't count a sent email", error);
  });
  return sent.id;
}

/** Where a scheduled email stands, as Resend reports it. */
const Status = z.object({ last_event: z.string().max(50).nullish() });

/**
 * Cancels a scheduled email: "cancelled" once it won't go (or Resend has no such email),
 * "sent" when it already went, or "retry" when Resend couldn't be asked, or the email is
 * so new that Resend hasn't finished scheduling it. Cancelling twice is fine. Only Resend
 * schedules, so only Resend cancels.
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
      reportError("An account email failed to send", error);
    }),
  );
}
