"use client";

import { Download, SendHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useId,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Button } from "react-aria-components";

import { MAX_CHAT_LENGTH } from "@/lib/meetings/events";
import { useIntlLocale } from "@/lib/preferences";

import { SidePanel } from "./side-panel";
import type { ChatMessage } from "./use-chat";

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

/** Message text with web links made clickable; nothing else is ever turned into HTML. */
function MessageText({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-[#8fb0ff] underline underline-offset-2 hover:text-[#b5cbff]"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Message({ message }: { message: ChatMessage }) {
  const t = useTranslations("Meeting.chat");
  const locale = useIntlLocale();
  return (
    <li className="flex items-start gap-2.5">
      {message.senderImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={message.senderImage}
          alt=""
          className="mt-px size-[30px] shrink-0 rounded-full"
        />
      ) : (
        <span className="mt-px size-[30px] shrink-0 rounded-full bg-white/10" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-bold">
            {message.mine ? t("you") : message.senderName}
          </span>
          <span className="text-muted-foreground font-mono text-xs">
            {new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(
              message.at,
            )}
          </span>
        </div>
        <p className="text-[15px] leading-normal break-words whitespace-pre-wrap text-[#e6eaee]">
          <MessageText text={message.text} />
        </p>
      </div>
    </li>
  );
}

/** Save chat, as in Zoom: the conversation so far as a text file on this device. */
function saveChat(
  messages: ChatMessage[],
  { title, you, locale }: { title: string; you: string; locale: string },
) {
  const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
  const text = messages
    .map(
      (m) => `[${time.format(m.at)}] ${m.mine ? you : m.senderName}: ${m.text}`,
    )
    .join("\n");
  const url = URL.createObjectURL(
    new Blob([`${title}\n\n${text}\n`], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  // File systems reject some characters; keep the name readable without them.
  link.download = `${title.replace(/[\\/:*?"<>|]+/g, "-")}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Chat: everyone sees it; nothing is saved after the meeting. */
export function ChatPanel({
  title,
  messages,
  canSend,
  onSend,
  onClose,
}: {
  /** The meeting's title, which names a saved chat. */
  title: string;
  messages: ChatMessage[];
  /** False when a host turned chat off for participants. */
  canSend: boolean;
  onSend: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations("Meeting.chat");
  const locale = useIntlLocale();
  const inputId = useId();
  const [draft, setDraft] = useState("");

  // Keep the newest message in view.
  const listRef = useCallback(
    (node: HTMLOListElement | null) => {
      if (node && messages.length > 0) node.scrollTop = node.scrollHeight;
    },
    [messages.length],
  );

  function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void onSend(text);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter starts a new line, as in most chat apps.
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      send();
    }
  }

  return (
    <SidePanel
      title={t("title")}
      closeLabel={t("close")}
      onClose={onClose}
      actions={
        <Button
          aria-label={t("save")}
          isDisabled={messages.length === 0}
          onPress={() =>
            saveChat(messages, {
              title: t("savedTitle", { title }),
              you: t("you"),
              locale,
            })
          }
          className="text-foreground/80 focus-visible:ring-ring flex size-10 items-center justify-center rounded-xl outline-none hover:bg-white/10 focus-visible:ring-2 disabled:opacity-40"
        >
          <Download className="size-5" aria-hidden="true" />
        </Button>
      }
    >
      <p className="bg-background text-muted-foreground mx-4 mb-2.5 shrink-0 rounded-[10px] px-3 py-2.5 text-[13px] leading-normal">
        {t("notice")}
      </p>
      <ol
        ref={listRef}
        aria-label={t("title")}
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-1.5 pb-3"
      >
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
      </ol>
      {canSend ? null : (
        <p
          role="status"
          className="text-muted-foreground shrink-0 border-t px-5 py-4 text-center text-sm"
        >
          {t("off")}
        </p>
      )}
      <form
        onSubmit={handleSubmit}
        hidden={!canSend}
        className="flex shrink-0 items-end gap-2 border-t px-3.5 pt-2.5 pb-3.5"
      >
        <label htmlFor={inputId} className="sr-only">
          {t("placeholder")}
        </label>
        <textarea
          id={inputId}
          rows={1}
          value={draft}
          maxLength={MAX_CHAT_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          className="bg-background focus-visible:ring-ring field-sizing-content max-h-32 min-h-[46px] min-w-0 flex-1 resize-none rounded-[23px] border px-3.5 py-3 text-base outline-none focus-visible:ring-2 md:text-[15px]"
        />
        <Button
          type="submit"
          aria-label={t("send")}
          isDisabled={draft.trim() === ""}
          className="bg-primary text-primary-foreground focus-visible:ring-ring flex size-[46px] shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 disabled:opacity-50"
        >
          <SendHorizontal className="size-5" aria-hidden="true" />
        </Button>
      </form>
    </SidePanel>
  );
}
