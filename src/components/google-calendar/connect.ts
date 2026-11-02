"use client";

import { linkSocial } from "@/lib/auth/client";
import {
  GOOGLE_CALENDAR_CONSENT,
  GOOGLE_CALENDAR_SCOPE,
  type CalendarConnection,
} from "@/lib/google-calendar/shared";

/** Settings → Calendar, where Google sends people back after its consent screen. */
export const CALENDAR_SETTINGS_ROUTE = "/settings/calendar";
/** How the consent window tells the page that opened it how connecting went. */
const CHANNEL = "faceon-google-calendar";
const WINDOW_NAME = "faceon-google-calendar";
/** Long enough to sign in to Google and choose; after that, nobody's waiting. */
const WAIT_MS = 10 * 60_000;

/** What the consent window reports: where the connection stands, and Google's error. */
export type ConnectReport = {
  connection: CalendarConnection;
  error: string | null;
};

/** Asks Better Auth to send this window, or the consent window, to Google. */
function startConsent(options: {
  back: string;
  loginHint?: string;
  inPopup: boolean;
}) {
  return linkSocial({
    provider: "google",
    scopes: [GOOGLE_CALENDAR_SCOPE],
    additionalParams: { ...GOOGLE_CALENDAR_CONSENT },
    loginHint: options.loginHint,
    callbackURL: options.back,
    errorCallbackURL: options.back,
    disableRedirect: options.inPopup,
  });
}

/**
 * Connect (or reconnect) Google Calendar from Settings: this page goes to Google's
 * consent screen and comes back to `back`. False if it couldn't start.
 */
export async function connectInPage(options: {
  back: string;
  loginHint?: string;
}): Promise<boolean> {
  const { error } = await startConsent({ ...options, inPopup: false });
  return !error;
}

/**
 * Connect (or reconnect) Google Calendar from a form: Google's consent screen opens in
 * a small window, so the form keeps what's typed, and the result comes back here. When
 * the browser blocks the window, this page goes instead and returns to `back`. Call it
 * straight from a click, so the browser allows the window.
 */
export async function connectInPopup(options: {
  back: string;
  loginHint?: string;
}): Promise<ConnectReport | null> {
  const popup = window.open("", WINDOW_NAME, "popup,width=520,height=700");
  if (!popup) {
    await connectInPage(options);
    return null;
  }
  const report = waitForReport();
  const { data, error } = await startConsent({
    back: `${CALENDAR_SETTINGS_ROUTE}?popup=1`,
    loginHint: options.loginHint,
    inPopup: true,
  });
  if (error || !data?.url) {
    popup.close();
    report.cancel();
    return null;
  }
  popup.location.href = data.url;
  return report.result;
}

/** Waits for the consent window's report (it may outlive any component). */
function waitForReport() {
  const channel = new BroadcastChannel(CHANNEL);
  let finish: (report: ConnectReport | null) => void = () => {};
  const result = new Promise<ConnectReport | null>((resolve) => {
    finish = (report) => {
      clearTimeout(timer);
      channel.close();
      resolve(report);
    };
  });
  const timer = setTimeout(() => finish(null), WAIT_MS);
  channel.onmessage = (event: MessageEvent<ConnectReport>) =>
    finish(event.data);
  return { result, cancel: () => finish(null) };
}

/** In the consent window, back from Google: tell the page that opened it, then close. */
export function reportToOpener(report: ConnectReport) {
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage(report);
  channel.close();
  window.close();
}
