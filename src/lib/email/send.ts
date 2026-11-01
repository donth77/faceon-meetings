import "server-only";

import { waitUntil } from "@vercel/functions";

import { serverEnv } from "@/lib/server-env";

export type Email = { to: string; subject: string; text: string; html: string };

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

export async function sendEmail(email: Email): Promise<void> {
  const resend = resendConfig();
  if (!resend) {
    if (!isDevelopment) throw new Error("Email delivery isn't configured.");
    console.info(
      `\n[email] To: ${email.to}\n[email] Subject: ${email.subject}\n\n${email.text}\n`,
    );
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resend.from,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend refused an email (HTTP ${response.status}).`);
  }
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
