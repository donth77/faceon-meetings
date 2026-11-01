import { z } from "zod";

/** Per-meeting options the host controls. Validated on every read and write. */
export const MeetingSettings = z.object({
  waitingRoom: z.boolean(),
  allowGuests: z.boolean(),
  joinBeforeHost: z.boolean(),
  muteOnEntry: z.boolean(),
  videoOffOnEntry: z.boolean(),
  /** false: participants need a host's OK to unmute. */
  allowSelfUnmute: z.boolean(),
  screenShare: z.enum(["host", "all"]),
  chat: z.boolean(),
  reactions: z.boolean(),
});
export type MeetingSettings = z.infer<typeof MeetingSettings>;

const BASE: MeetingSettings = {
  waitingRoom: false,
  allowGuests: true,
  joinBeforeHost: true,
  muteOnEntry: false,
  videoOffOnEntry: false,
  allowSelfUnmute: true,
  screenShare: "all",
  chat: true,
  reactions: true,
};

/** Defaults by meeting type: personal rooms use the waiting room; scheduled ones wait for the host. */
export const DEFAULT_SETTINGS = {
  instant: BASE,
  scheduled: { ...BASE, joinBeforeHost: false },
  personal: { ...BASE, waitingRoom: true },
} as const satisfies Record<string, MeetingSettings>;
