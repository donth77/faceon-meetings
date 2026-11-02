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
import { MAX_COHOSTS, MAX_INVITEES } from "@/lib/meetings/schedule";

/** A stable default avatar for an address, from the same set as everyone else's. */
function avatarFor(email: string): string {
  let hash = 0;
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `/avatar/${hash.toString(16).padStart(8, "0").repeat(2)}-n.svg`;
}

/**
 * Email addresses as chips: type or paste them; Enter, comma, space or leaving the field
 * turns each into a chip. Backspace in an empty field removes the last one.
 */
function EmailsField({
  label,
  optional,
  help,
  value,
  onChange,
  max,
  removeLabel,
  fullText,
  refuse,
}: {
  label: string;
  optional: string;
  /** What the addresses are for, under the field. */
  help?: string | undefined;
  value: string[];
  onChange: (emails: string[]) => void;
  max: number;
  removeLabel: (email: string) => string;
  /** Said when the list is full. */
  fullText: string;
  /** Why an address can't go on this list (it's your own, say), or null. */
  refuse?: ((email: string) => string | null) | undefined;
}) {
  const t = useTranslations("Schedule");
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const helpId = useId();
  const errorId = useId();
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  function add(text: string): boolean {
    const emails = text
      .split(/[\s,;]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const bad = emails.find((email) => !isEmailAddress(email));
    if (bad) {
      setProblem(t("invalidEmail", { email: bad }));
      return false;
    }
    const refused = emails.map((email) => refuse?.(email)).find(Boolean);
    if (refused) {
      setProblem(refused);
      return false;
    }
    const next = [...value];
    for (const email of emails) if (!next.includes(email)) next.push(email);
    onChange(next.slice(0, max));
    setProblem(null);
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

  const describedBy = [help ? helpId : null, problem ? errorId : null]
    .filter(Boolean)
    .join(" ");

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
              aria-label={removeLabel(email)}
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
            setProblem(null);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            if (draft.trim() && add(draft)) setDraft("");
          }}
          placeholder={value.length === 0 ? t("addEmails") : undefined}
          aria-invalid={problem !== null}
          aria-describedby={describedBy || undefined}
          disabled={value.length >= max}
          className="h-8 min-w-40 flex-1 bg-transparent px-1.5 text-base outline-none"
        />
      </div>
      {help ? (
        <p id={helpId} className="text-muted-foreground text-[13px]">
          {help}
        </p>
      ) : null}
      {problem ? (
        <p id={errorId} role="alert" className="text-destructive-text text-sm">
          {problem}
        </p>
      ) : null}
      {/* At the cap the field stops taking addresses; say why, as it happens. */}
      <p role="status" className="text-muted-foreground text-sm empty:hidden">
        {value.length >= max ? fullText : ""}
      </p>
    </div>
  );
}

/** Invite people by email. */
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
  return (
    <EmailsField
      label={label}
      optional={optional}
      value={value}
      onChange={onChange}
      max={MAX_INVITEES}
      removeLabel={(email) => t("removeInvitee", { email })}
      fullText={t("inviteesFull", { count: MAX_INVITEES })}
    />
  );
}

/**
 * Co-hosts named ahead of time: they join as co-hosts when signed in with one of these
 * addresses, and are invited too where the meeting sends invitations. Never the host's
 * own address: they host.
 */
export function CohostsField({
  value,
  onChange,
  hostEmail,
  help,
}: {
  value: string[];
  onChange: (emails: string[]) => void;
  hostEmail: string;
  /** What they get here (invited too, or not). */
  help: string;
}) {
  const t = useTranslations("Schedule");
  const own = hostEmail.toLowerCase();
  return (
    <EmailsField
      label={t("cohosts")}
      optional={t("optional")}
      help={help}
      value={value}
      onChange={onChange}
      max={MAX_COHOSTS}
      removeLabel={(email) => t("removeCohost", { email })}
      fullText={t("cohostsFull", { count: MAX_COHOSTS })}
      refuse={(email) => (email === own ? t("cohostIsYou") : null)}
    />
  );
}
