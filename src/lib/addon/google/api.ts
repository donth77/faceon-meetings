/**
 * The add-on API's request schemas: every request is checked against these before
 * anything else happens. The types they check are in types.ts, shared with the add-on.
 */
import { z } from "zod";

import { MAX_TITLE } from "@/lib/meetings/schedule";

import type {
  AddonErrorCode,
  ConferenceCreate as ConferenceCreateType,
  ConferenceUpdate as ConferenceUpdateType,
  EventTiming as EventTimingType,
  MeetingCreate as MeetingCreateType,
} from "./types";

const Instant = z.iso.datetime({ offset: true });
const Locale = z.string().max(35);

export const EventTiming = z.object({
  title: z.string().max(1024).optional(),
  start: Instant,
  end: Instant,
  timeZone: z.string().max(64).optional(),
  allDay: z.boolean().optional(),
  recurrence: z.array(z.string().max(2000)).max(20).optional(),
}) satisfies z.ZodType<EventTimingType>;

export const ConferenceCreate = z.object({
  eventId: z.string().min(1).max(1024),
  calendarId: z.string().min(1).max(320),
  locale: Locale.optional(),
  event: EventTiming.optional(),
}) satisfies z.ZodType<ConferenceCreateType>;

export const ConferenceUpdate = z.union([
  z.object({ event: EventTiming }),
  z.object({
    occurrence: z.object({
      originalStart: Instant,
      start: Instant.optional(),
      end: Instant.optional(),
      cancelled: z.boolean().optional(),
    }),
  }),
]) satisfies z.ZodType<ConferenceUpdateType>;

export const MeetingCreate = z.object({
  kind: z.enum(["new", "personalRoom"]),
  title: z.string().trim().max(MAX_TITLE).optional(),
  locale: Locale.optional(),
}) satisfies z.ZodType<MeetingCreateType>;

export const HomeQuery = z.object({
  locale: Locale.optional(),
  timeZone: z.string().max(64).optional(),
});

/** Each error's HTTP status. */
export const ADDON_ERRORS: Record<AddonErrorCode, number> = {
  NOT_AVAILABLE: 404,
  INVALID_TOKEN: 401,
  AUTHENTICATION: 403,
  RATE_LIMITED: 429,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  PERMANENT: 422,
  TEMPORARY: 503,
};
