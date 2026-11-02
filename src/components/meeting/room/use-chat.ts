"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { MAX_CHAT_LENGTH } from "@/lib/meetings/events";

import type { RoomMedia } from "../media";

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderImage?: string;
  text: string;
  /** When it arrived on this device. */
  at: number;
  mine: boolean;
};

/** Keeps the newest messages; chat isn't stored, so a long meeting doesn't grow forever. */
const KEEP = 500;

/**
 * Meeting chat over the provider's events. Your own messages show at once; the id
 * drops the provider's echo. Counts unread messages and previews them while the chat
 * panel is closed.
 */
export function useChat({
  media,
  self,
  isOpen,
  onPreview,
}: {
  media: Pick<RoomMedia, "sendEvent" | "subscribeEvents">;
  self: { id: string; name: string; image?: string };
  isOpen: boolean;
  onPreview: (message: ChatMessage) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const seen = useRef(new Set<string>());
  const panelOpen = useEffectEvent(() => isOpen);
  const preview = useEffectEvent(onPreview);
  const { subscribeEvents, sendEvent } = media;

  useEffect(
    () =>
      subscribeEvents((event, sender) => {
        if (event.type !== "chat.message" || sender.userId === self.id) return;
        const message: ChatMessage = {
          id: event.id,
          senderId: sender.userId,
          senderName: sender.name,
          ...(sender.image ? { senderImage: sender.image } : {}),
          text: event.text,
          at: Date.now(),
          mine: false,
        };
        if (seen.current.has(message.id)) return; // a repeat delivery
        seen.current.add(message.id);
        setMessages((list) => [...list, message].slice(-KEEP));
        if (!panelOpen()) {
          setUnread((n) => n + 1);
          preview(message);
        }
      }),
    [subscribeEvents, self.id],
  );

  async function send(text: string) {
    const trimmed = text.trim().slice(0, MAX_CHAT_LENGTH);
    if (!trimmed) return;
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: self.id,
      senderName: self.name,
      ...(self.image ? { senderImage: self.image } : {}),
      text: trimmed,
      at: Date.now(),
      mine: true,
    };
    seen.current.add(message.id);
    setMessages((list) => [...list, message].slice(-KEEP));
    await sendEvent({ type: "chat.message", id: message.id, text: trimmed });
  }

  return { messages, unread, markRead: () => setUnread(0), send };
}
