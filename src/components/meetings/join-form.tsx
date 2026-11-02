"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseMeetingInput } from "@/lib/meetings/codes";
import { meetingPath } from "@/lib/routes";

/**
 * "Enter a meeting ID or link" + Join. Accepts "123 456 7890" or a pasted invite link.
 * With a `label`, it shows as a visible label above the field and Join is the primary
 * button (the sign-in page's "Joining a meeting?" card).
 */
export function JoinForm({ label }: { label?: string }) {
  const t = useTranslations("Join");
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseMeetingInput(value);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    router.push(meetingPath(parsed.code, parsed.passcode));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5" noValidate>
      {/* Always visible: a placeholder disappears once you type. */}
      <label
        htmlFor={inputId}
        className={
          label ? "text-[15px] font-semibold" : "text-sm font-semibold"
        }
      >
        {label ?? t("label")}
      </label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          placeholder={t("placeholder")}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          inputMode="text"
          autoComplete="off"
          className="h-11 min-w-0 flex-1"
        />
        <Button
          type="submit"
          variant={label ? "default" : "outline"}
          size="lg"
          isDisabled={value.trim() === ""}
          className={label ? "h-11 px-5" : undefined}
        >
          {t("submit")}
        </Button>
      </div>
      {invalid ? (
        <p id={errorId} role="alert" className="text-destructive-text text-sm">
          {t("error")}
        </p>
      ) : null}
    </form>
  );
}
