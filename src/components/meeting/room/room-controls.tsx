"use client";

import { createContext, use, type ReactNode } from "react";

import type { ModerateRequest } from "@/lib/meetings/api";

import type { RoomParticipant } from "../media";
import type { RoomRole } from "./roles";

/** What tiles and participant rows need to offer pinning, spotlight and host actions. */
export type RoomControls = {
  selfId: string;
  selfRole: RoomRole;
  roleOf: (userId: string) => RoomRole;
  /** The tile you pinned for yourself, by participant key. */
  pinnedKey: string | null;
  togglePin: (key: string) => void;
  /** The person a host spotlighted for everyone. */
  spotlight: string | null;
  moderate: (request: ModerateRequest) => Promise<void>;
  /** Asks the host to confirm before removing someone. */
  confirmRemove: (participant: RoomParticipant) => void;
};

const RoomControlsContext = createContext<RoomControls | null>(null);

export function RoomControlsProvider({
  value,
  children,
}: {
  value: RoomControls;
  children: ReactNode;
}) {
  return <RoomControlsContext value={value}>{children}</RoomControlsContext>;
}

export function useRoomControls(): RoomControls {
  const controls = use(RoomControlsContext);
  if (!controls) throw new Error("Room controls are used outside a meeting.");
  return controls;
}
