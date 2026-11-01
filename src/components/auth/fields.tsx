"use client";

import { cn } from "cn";
import { Eye, EyeOff, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { ToggleButton } from "react-aria-components";

import { Input } from "@/components/ui/input";

const inputClass = "h-12 rounded-xl px-3.5 text-base md:text-base";

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      id={id}
      className="text-destructive flex items-start gap-1.5 text-[13px] leading-[1.45]"
    >
      <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  error?: string | null;
  disabled?: boolean;
};

/** A labelled text input with an inline error, as the account forms use. */
export function TextField({
  label,
  value,
  onChange,
  autoComplete,
  error,
  disabled,
  type = "text",
}: FieldProps & { type?: "text" | "email" }) {
  const id = useId();
  const errorId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        spellCheck={false}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClass}
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

/** A password input with Show password, an optional hint, and an inline error. */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  error,
  disabled,
  hint,
  aside,
}: FieldProps & {
  hint?: string;
  /** Beside the label, e.g. "Forgot password?". */
  aside?: ReactNode;
}) {
  const t = useTranslations("Auth");
  const [visible, setVisible] = useState(false);
  const id = useId();
  const messageId = useId();
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative flex">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(inputClass, "pr-13")}
        />
        <ToggleButton
          isSelected={visible}
          onChange={setVisible}
          aria-label={t("showPassword")}
          className="text-muted-foreground hover:bg-muted focus-visible:ring-ring absolute top-0.5 right-0.5 flex size-11 items-center justify-center rounded-[10px] outline-none focus-visible:ring-2"
        >
          {visible ? (
            <EyeOff className="size-5" aria-hidden="true" />
          ) : (
            <Eye className="size-5" aria-hidden="true" />
          )}
        </ToggleButton>
      </div>
      {error ? (
        <FieldError id={messageId}>{error}</FieldError>
      ) : hint ? (
        <p id={messageId} className="text-muted-foreground text-[13px]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A message above a form: a problem (role="alert") or news, such as "we sent a link". */
export function FormNotice({
  icon: Icon,
  tone = "neutral",
  role = "alert",
  children,
}: {
  icon: LucideIcon;
  tone?: "neutral" | "warning";
  role?: "alert" | "status";
  children: ReactNode;
}) {
  return (
    <div
      role={role}
      className={cn(
        "flex gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-[1.45]",
        tone === "warning"
          ? "bg-amber-100 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100"
          : "bg-muted text-foreground",
      )}
    >
      <Icon
        className="mt-px size-[18px] shrink-0 opacity-75"
        aria-hidden="true"
      />
      <span>{children}</span>
    </div>
  );
}

export const isEmailAddress = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
