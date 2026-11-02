"use client";

import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import type { LobbyAction, LobbyEntry } from "@/lib/meetings/api";

import { meetingApi } from "../api-client";
import { playSound } from "../chime";
import type { RoomMedia } from "../media";

/** While someone waits, check this often too, in case an update was missed. */
const FALLBACK_POLL_MS = 15_000;

/**
 * The waiting room, for hosts and co-hosts: who's asking to join, kept current by the
 * server's lobby.updated events. Each new request chimes and shows a toast with Admit.
 */
export function useLobby({
  code,
  isHost,
  media,
  onView,
}: {
  code: string;
  isHost: boolean;
  media: Pick<RoomMedia, "subscribeEvents">;
  /** Opens the list (Participants). */
  onView: () => void;
}) {
  const t = useTranslations("Meeting.lobby");
  const [requests, setRequests] = useState<LobbyEntry[]>([]);
  const known = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    try {
      const { requests: next } = await meetingApi.lobby(code);
      setRequests(next);
    } catch {
      // The next event or check tries again.
    }
  }, [code]);

  const decide = useCallback(
    async (action: LobbyAction) => {
      if (action.action === "admitAll") setRequests([]);
      else {
        const ids = new Set(action.ids);
        setRequests((list) => list.filter((r) => !ids.has(r.id)));
      }
      try {
        await meetingApi.decide(code, action);
      } catch {
        toast.error(t("failed"));
        void refresh();
      }
    },
    [code, refresh, t],
  );

  // Announce each new request once, with a chime. A request's toast goes away once
  // someone decides it, or the person stops asking.
  const announce = useEffectEvent((fresh: LobbyEntry[]) => {
    playSound("knock");
    const [first] = fresh;
    if (fresh.length === 1 && first) {
      toast(t("wantsToJoin", { name: first.name }), {
        id: `lobby-${first.id}`,
        action: {
          label: t("admit"),
          onClick: () => void decide({ action: "admit", ids: [first.id] }),
        },
        cancel: { label: t("view"), onClick: onView },
      });
    } else {
      toast(t("manyWantToJoin", { count: fresh.length }), {
        id: "lobby-many",
        action: { label: t("viewAll"), onClick: onView },
      });
    }
  });
  useEffect(() => {
    const current = new Set(requests.map((r) => r.id));
    for (const id of known.current) {
      if (!current.has(id)) {
        toast.dismiss(`lobby-${id}`);
        known.current.delete(id);
      }
    }
    if (current.size === 0) toast.dismiss("lobby-many");
    const fresh = requests.filter((r) => !known.current.has(r.id));
    for (const r of fresh) known.current.add(r.id);
    if (fresh.length > 0) announce(fresh);
  }, [requests]);

  const { subscribeEvents } = media;
  useEffect(() => {
    if (!isHost) return;
    // A first look once you're a host, then whenever the server says it changed.
    const first = setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeEvents((event, sender) => {
      if (sender === null && event.type === "lobby.updated") void refresh();
    });
    return () => {
      clearTimeout(first);
      unsubscribe();
    };
  }, [isHost, subscribeEvents, refresh]);

  const waiting = isHost && requests.length > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void refresh(), FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, refresh]);

  return { requests: isHost ? requests : [], decide };
}
