import type { MeetingRole } from "@/lib/media/types";
import type { SharedSessionState } from "@/lib/meetings/events";

/** How the room treats someone: hosts and co-hosts moderate, everyone else takes part. */
export type RoomRole = "host" | "cohost" | "participant";

/** Someone's role, from the session's shared state (our server keeps it current). */
export function roleIn(
  state: SharedSessionState | null,
  userId: string,
): RoomRole {
  if (!state) return "participant";
  if (state.host === userId) return "host";
  return state.cohosts.includes(userId) ? "cohost" : "participant";
}

/** The role you were admitted with, before the shared state arrives. */
export const roomRoleOf = (role: MeetingRole): RoomRole =>
  role === "host" || role === "cohost" ? role : "participant";

export const moderates = (role: RoomRole) => role !== "participant";
