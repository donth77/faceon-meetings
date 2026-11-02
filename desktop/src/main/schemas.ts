import { z } from "zod";

import { isAccelerator } from "../../../src/lib/desktop/accelerator";
import type {
  DesktopCommand,
  DesktopMeetingState,
  DesktopPreferences,
  DesktopReminderMinutes,
} from "../../../src/lib/desktop/bridge";

/** The mute shortcut: checked as Settings → Desktop app checks it. */
const Accelerator = z.string().max(64).refine(isAccelerator);
export const DEFAULT_ACCELERATOR = "CommandOrControl+Shift+A";

export const PreferencesSchema = z.object({
  launchAtLogin: z.boolean().default(false),
  keepInTray: z.boolean().default(true),
  openLinksInApp: z.boolean().default(true),
  muteShortcut: z
    .object({
      enabled: z.boolean().default(true),
      accelerator: Accelerator.default(DEFAULT_ACCELERATOR),
    })
    .prefault({}),
  badge: z.boolean().default(true),
  channel: z.enum(["latest", "beta"]).default("latest"),
}) satisfies z.ZodType<DesktopPreferences>;

/** A change from Settings → Desktop app: only known settings, each checked. */
export const PreferencesChange = z
  .object({
    launchAtLogin: z.boolean(),
    keepInTray: z.boolean(),
    openLinksInApp: z.boolean(),
    muteShortcut: z.object({
      enabled: z.boolean(),
      accelerator: Accelerator,
    }),
    badge: z.boolean(),
    channel: z.enum(["latest", "beta"]),
  })
  .partial()
  .strict();

export const ReminderMinutes = z.union([
  z.literal(0),
  z.literal(5),
  z.literal(10),
  z.literal(15),
]) satisfies z.ZodType<DesktopReminderMinutes>;

export const MeetingState = z
  .object({
    inMeeting: z.boolean(),
    muted: z.boolean(),
    title: z.string().max(200).optional(),
  })
  .strict() satisfies z.ZodType<DesktopMeetingState>;

export const Unread = z.number().int().min(0).max(9999);
export const Provider = z.enum(["google", "github"]);
/** A path on the app's own origin: never a full URL or a protocol-relative one. */
export const AppPath = z
  .string()
  .max(512)
  .regex(/^\/(?![/\\])[^\s\\]*$/);

export const WindowState = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().min(300).max(10000),
  height: z.number().int().min(300).max(10000),
  maximized: z.boolean(),
});

/** Everything the app keeps in userData/state.json. */
export const AppState = z.object({
  preferences: PreferencesSchema.prefault({}),
  reminderMinutes: ReminderMinutes.default(0),
  window: WindowState.optional(),
});
export type AppState = z.infer<typeof AppState>;

/** The saved state, or the defaults where it's missing or unreadable. */
export function parseAppState(raw: unknown): AppState {
  const parsed = AppState.safeParse(raw);
  return parsed.success ? parsed.data : AppState.parse({});
}

export const Command = z.discriminatedUnion("type", [
  z.object({ type: z.literal("toggleMute") }),
  z.object({ type: z.literal("leave") }),
  z.object({ type: z.literal("open"), path: AppPath }),
]) satisfies z.ZodType<DesktopCommand>;
