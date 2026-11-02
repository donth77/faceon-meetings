"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { isEmailAddress } from "@/lib/email-address";
import { MAX_INVITEES } from "@/lib/meetings/schedule";

/** A stable default avatar for an address, from the same set as everyone else's. */
function avatarFor(email: string): string {
  let hash = 0;
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `/avatar/${hash.toString(16).padStart(8, "0").repeat(2)}-n.svg`;
}

/**
 * Invite people: type or paste addresses; Enter, comma, space or leaving the field turns
 * each into a chip. Backspace in an empty field removes the last one.
 */
export function InviteesField({
  label,
  optional,
  value,
  onChange,
}: {
  label: string;
  optional: string;
  value: string[];
  onChange: (emails: string[]) => void;
}) {
  const t = useTranslations("Schedule");
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);

  function add(text: string): boolean {
    const emails = text
      .split(/[\s,;]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const bad = emails.find((email) => !isEmailAddress(email));
    if (bad) {
      setInvalid(bad);
      return false;
    }
    const next = [...value];
    for (const email of emails) if (!next.includes(email)) next.push(email);
    onChange(next.slice(0, MAX_INVITEES));
    setInvalid(null);
    return true;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (["Enter", ",", " ", ";"].includes(event.key)) {
      if (draft.trim()) {
        event.preventDefault();
        if (add(draft)) setDraft("");
      } else if (event.key !== "Enter") {
        event.preventDefault();
      }
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (/[\s,;]/.test(text.trim())) {
      event.preventDefault();
      if (add(text)) setDraft("");
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
        <span className="text-muted-foreground font-normal"> {optional}</span>
      </label>
      <div className="bg-background border-input focus-within:focus-ring flex min-h-12 flex-wrap items-center gap-1.5 rounded-[10px] border p-1.5">
        {value.map((email) => (
          <span
            key={email}
            className="bg-muted flex h-8 max-w-full items-center gap-1.5 rounded-full pr-0.5 pl-1 text-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarFor(email)}
              alt=""
              className="size-6 shrink-0 rounded-full"
            />
            <span className="truncate">{email}</span>
            <button
              type="button"
              aria-label={t("removeInvitee", { email })}
              onClick={() => {
                onChange(value.filter((e) => e !== email));
                input.current?.focus();
              }}
              className="focus-visible:focus-ring flex size-7 shrink-0 items-center justify-center rounded-full outline-hidden hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={input}
          id={inputId}
          type="email"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(null);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            if (draft.trim() && add(draft)) setDraft("");
          }}
          placeholder={value.length === 0 ? t("addEmails") : undefined}
          aria-invalid={invalid !== null}
          aria-describedby={invalid ? errorId : undefined}
          disabled={value.length >= MAX_INVITEES}
          className="h-8 min-w-40 flex-1 bg-transparent px-1.5 text-base outline-none"
        />
      </div>
      {invalid ? (
        <p id={errorId} role="alert" className="text-destructive-text text-sm">
          {t("invalidEmail", { email: invalid })}
        </p>
      ) : null}
      {/* At the cap the field stops taking addresses; say why, as it happens. */}
      <p role="status" className="text-muted-foreground text-sm empty:hidden">
        {value.length >= MAX_INVITEES
          ? t("inviteesFull", { count: MAX_INVITEES })
          : ""}
      </p>
    </div>
  );
}
