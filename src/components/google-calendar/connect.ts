"use client";

import { z } from "zod";

import type { AddonReply, AddonSetup } from "@/lib/addon/google/setup-shared";
import { authClient, linkSocial } from "@/lib/auth/client";
import type { FaceonDesktop } from "@/lib/desktop/bridge";
import { desktopBridge } from "@/lib/desktop/use-desktop";
import {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_OFFLINE_CONSENT,
  type CalendarConnection,
  type GoogleScope,
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
  void openInBrowser(desktop, DESKTOP_CALENDAR_ROUTE);
  waitingForBrowser ??= waitFor(currentConnection, (connection) =>
    connection.status === "connected" ? { connection, error: null } : null,
  ).finally(() => {
    waitingForBrowser = null;
  });
  return waitingForBrowser;
}

/**
 * Adding FaceOn to Google Calendar and Gmail from the desktop app, or updating it: the
 * same way, through the browser, where Settings → Calendar does it after Google's
 * consent. Waits until the add-on shows added and up to date (null after a while).
 * Null outside the app.
 */
export function addAddonInBrowser(
  action: "add" | "update",
): Promise<AddonSetup | null> | null {
  const desktop = desktopBridge();
  if (!desktop) return null;
  void openInBrowser(desktop, `${DESKTOP_CALENDAR_ROUTE}?addon=${action}`);
  return waitFor(currentAddon, (addon) =>
    (addon.status === "created" || addon.status === "connected") &&
    !addon.needsUpdate
      ? addon
      : null,
  );
}

/** The browser's page, for this account: it says so when the browser's is another. */
async function openInBrowser(desktop: FaceonDesktop, path: string) {
  const { data } = await authClient.getSession().catch(() => ({ data: null }));
  const account = data
    ? `${path.includes("?") ? "&" : "?"}for=${encodeURIComponent(data.user.id)}`
    : "";
  desktop.openInBrowser(`${path}${account}`);
}

/**
 * Looks every few seconds, and when the window comes back to the front, until `done`
 * makes something of what it found (null after a while).
 */
function waitFor<T, R>(
  look: () => Promise<T | null>,
  done: (value: T) => R | null,
): Promise<R | null> {
  return new Promise((resolve) => {
    const since = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: R | null) => {
      clearTimeout(timer);
      window.removeEventListener("focus", again);
      resolve(result);
    };
    async function again() {
      clearTimeout(timer);
      const value = await look();
      const result = value === null ? null : done(value);
      if (result !== null) {
        finish(result);
      } else if (Date.now() - since >= WAIT_MS) {
        finish(null);
      } else {
        timer = setTimeout(again, POLL_MS);
      }
    }
    window.addEventListener("focus", again);
    timer = setTimeout(again, POLL_MS);
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

const AddonSetupReply = z.object({
  addon: z.discriminatedUnion("status", [
    z.object({ status: z.literal("unavailable") }),
    z.object({ status: z.literal("none"), granted: z.boolean() }),
    z.object({
      status: z.enum(["created", "connected"]),
      scriptId: z.string(),
      needsUpdate: z.boolean(),
    }),
  ]),
  problem: z
    .enum([
      "consent",
      "userApiOff",
      "serviceDisabled",
      "blocked",
      "missing",
      "failed",
    ])
    .optional(),
  consoleUrl: z.url().optional(),
}) satisfies z.ZodType<AddonReply>;

/**
 * Asks FaceOn where the person's add-on stands (GET), or adds, updates (POST) or removes
 * it (DELETE). Null when FaceOn couldn't answer.
 */
export async function addonRequest(
  method: "GET" | "POST" | "DELETE",
  action?: "add" | "update",
): Promise<AddonReply | null> {
  try {
    const response = await fetch("/api/integrations/google-addon", {
      method,
      cache: "no-store",
      ...(action
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action }),
          }
        : {}),
    });
    if (!response.ok) return null;
    return AddonSetupReply.parse(await response.json());
  } catch {
    return null;
  }
}

async function currentAddon(): Promise<AddonSetup | null> {
  return (await addonRequest("GET"))?.addon ?? null;
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

/**
 * Asks Better Auth to send this window, or the consent window, to Google. `anyAccount`
 * lets the person pick a Google account whose email isn't theirs, once they've
 * confirmed it (allowDifferentEmail).
 */
function startConsent(options: {
  back: string;
  loginHint?: string;
  inPopup: boolean;
  scope?: GoogleScope;
  anyAccount?: boolean;
}) {
  return linkSocial({
    provider: "google",
    scopes: [options.scope ?? GOOGLE_CALENDAR_SCOPE],
    additionalParams: options.anyAccount
      ? { ...GOOGLE_OFFLINE_CONSENT, prompt: "consent select_account" }
      : { ...GOOGLE_OFFLINE_CONSENT },
    loginHint: options.anyAccount ? undefined : options.loginHint,
    callbackURL: options.back,
    errorCallbackURL: options.back,
    disableRedirect: options.inPopup,
  });
}

/**
 * The person confirmed connecting a Google account whose email isn't their account's:
 * FaceOn allows it for a few minutes, and only after a recent sign-in
 * (lib/auth/linking-rules.ts). "signInAgain" when their sign-in is too old.
 */
export async function allowDifferentEmail(): Promise<
  "ok" | "signInAgain" | "failed"
> {
  try {
    const response = await fetch("/api/integrations/google-link", {
      method: "POST",
      cache: "no-store",
    });
    if (response.ok) return "ok";
    const body: unknown = await response.json().catch(() => null);
    return response.status === 403 &&
      typeof body === "object" &&
      body !== null &&
      "problem" in body &&
      body.problem === "signInAgain"
      ? "signInAgain"
      : "failed";
  } catch {
    return "failed";
  }
}

/**
 * Connect (or reconnect) Google Calendar from Settings, or give FaceOn another `scope`
 * (the add-on's): this page goes to Google's consent screen and comes back to `back`.
 * False if it couldn't start.
 */
export async function connectInPage(options: {
  back: string;
  loginHint?: string;
  scope?: GoogleScope;
  anyAccount?: boolean;
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
