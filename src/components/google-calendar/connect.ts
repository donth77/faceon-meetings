"use client";

import { z } from "zod";

import { authClient, linkSocial } from "@/lib/auth/client";
import type { FaceonDesktop } from "@/lib/desktop/bridge";
import { desktopBridge } from "@/lib/desktop/use-desktop";
import {
  GOOGLE_CALENDAR_CONSENT,
  GOOGLE_CALENDAR_SCOPE,
  type CalendarConnection,
} from "@/lib/google-calendar/shared";

/** Settings → Calendar, where Google sends people back after its consent screen. */
export const CALENDAR_SETTINGS_ROUTE = "/settings/calendar";

/** Where the desktop app sends people to connect Google Calendar, in their browser. */
export const DESKTOP_CALENDAR_ROUTE = "/desktop/calendar";

/** How often the desktop app looks while someone connects in their browser. */
const POLL_MS = 3000;

const ConnectionReply = z.object({
  connection: z.discriminatedUnion("status", [
    z.object({ status: z.literal("unavailable") }),
    z.object({ status: z.literal("disconnected") }),
    z.object({ status: z.literal("connected"), email: z.string() }),
    z.object({ status: z.literal("reconnect") }),
  ]),
});

let waitingForBrowser: Promise<ConnectReport | null> | null = null;

/**
 * Inside the desktop app, Google refuses its consent screen (as it refuses sign-in in
 * embedded browsers), so the browser goes straight to it (/desktop/calendar), and this
 * waits until the account shows connected (null after a while). Null outside the app.
 */
export function connectInBrowser(): Promise<ConnectReport | null> | null {
  const desktop = desktopBridge();
  if (!desktop) return null;
  void openInBrowser(desktop);
  waitingForBrowser ??= waitForConnection().finally(() => {
    waitingForBrowser = null;
  });
  return waitingForBrowser;
}

/** The browser's page, for this account: it says so when the browser's is another. */
async function openInBrowser(desktop: FaceonDesktop) {
  const { data } = await authClient.getSession().catch(() => ({ data: null }));
  const account = data ? `?for=${encodeURIComponent(data.user.id)}` : "";
  desktop.openInBrowser(`${DESKTOP_CALENDAR_ROUTE}${account}`);
}

/** Looks every few seconds, and when the window comes back to the front. */
function waitForConnection(): Promise<ConnectReport | null> {
  return new Promise((resolve) => {
    const since = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (report: ConnectReport | null) => {
      clearTimeout(timer);
      window.removeEventListener("focus", look);
      resolve(report);
    };
    async function look() {
      clearTimeout(timer);
      const connection = await currentConnection();
      if (connection?.status === "connected") {
        finish({ connection, error: null });
      } else if (Date.now() - since >= WAIT_MS) {
        finish(null);
      } else {
        timer = setTimeout(look, POLL_MS);
      }
    }
    window.addEventListener("focus", look);
    timer = setTimeout(look, POLL_MS);
  });
}

async function currentConnection(): Promise<CalendarConnection | null> {
  try {
    const response = await fetch("/api/integrations/google-calendar", {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return ConnectionReply.parse(await response.json()).connection;
  } catch {
    return null;
  }
}

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
