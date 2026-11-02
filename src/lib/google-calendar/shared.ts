/**
 * Google Calendar sync, the parts the browser needs too: the one scope FaceOn asks for,
 * how it asks, and what the server reports back. Safe to import in the browser.
 */
import { linkProblem } from "@/lib/auth/problems";

/**
 * "See, create, change and delete events on Google calendars you own": the narrowest
 * scope that can invite people. FaceOn only touches the events it makes.
 */
export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.owned";

/**
 * Google's consent screen, asking for offline access, so Google sends a refresh token
 * even to someone who already signed in with Google (sign-in never asks for one).
 */
export const GOOGLE_CALENDAR_CONSENT = {
  access_type: "offline",
  prompt: "consent",
} as const;

/** The scopes a stored account granted (Better Auth keeps them comma-separated). */
const scopesOf = (scope: string | null | undefined) =>
  (scope ?? "").split(/[\s,]+/).filter(Boolean);

/** Whether an account's granted scopes include calendar access. */
export function hasCalendarScope(scope: string | null | undefined): boolean {
  return scopesOf(scope).includes(GOOGLE_CALENDAR_SCOPE);
}

/** The granted scopes without calendar access, as Better Auth stores them. */
export function withoutCalendarScope(scope: string | null | undefined): string {
  return scopesOf(scope)
    .filter((granted) => granted !== GOOGLE_CALENDAR_SCOPE)
    .join(",");
}

/** A synced meeting's events in Google Calendar: the event ID for each key. */
export type GoogleEventIds = Record<string, string>;

/** Where someone's Google Calendar connection stands. */
export type CalendarConnection =
  /** This copy of FaceOn doesn't offer Calendar sync. */
  | { status: "unavailable" }
  | { status: "disconnected" }
  | { status: "connected"; email: string }
  /** Google no longer accepts FaceOn's access (revoked, or expired after a week). */
  | { status: "reconnect" };

/** What happened in Google Calendar after FaceOn saved or deleted a meeting. */
export type CalendarOutcome = "synced" | "failed" | "reconnect";

/**
 * Why connecting Google Calendar didn't work, from the error Google's consent screen
 * came back with. No error means Google connected, but without calendar access (the
 * person unticked it on the consent screen).
 */
export function connectProblem(
  error: string | null,
): "emailMismatch" | "alreadyLinked" | "denied" | "scope" | "generic" {
  if (!error) return "scope";
  if (error === "access_denied") return "denied";
  return linkProblem(error);
}
