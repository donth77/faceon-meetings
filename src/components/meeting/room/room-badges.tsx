"use client";

import { createContext, use, type ReactNode } from "react";

import type { ReactionCode } from "@/lib/meetings/events";

/** What tiles show in their corner: a raised hand and the latest reaction, per person. */
export type RoomBadges = {
  hands: Record<string, string>;
  reactions: ReadonlyMap<string, ReactionCode>;
};

const RoomBadgesContext = createContext<RoomBadges>({
  hands: {},
  reactions: new Map(),
});

export function RoomBadgesProvider({
  value,
  children,
}: {
  value: RoomBadges;
  children: ReactNode;
}) {
  return <RoomBadgesContext value={value}>{children}</RoomBadgesContext>;
}

export const useRoomBadges = () => use(RoomBadgesContext);
