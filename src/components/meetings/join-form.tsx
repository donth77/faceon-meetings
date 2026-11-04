"use client";

import { cn } from "cn";
import { Keyboard, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicEnv } from "@/lib/env";
import {
  formatTypedMeetingId,
  readMeetingInput,
  type MeetingInputProblem,
} from "@/lib/meetings/codes";
import { lookUpMeeting, type LookupResult } from "@/lib/meetings/lookup";
import { meetingPath } from "@/lib/routes";

/** What the field can say is wrong: with what was entered, or with the meeting it names. */
type Problem = MeetingInputProblem | Exclude<LookupResult, "open" | "unknown">;

/** This site's hosts, which meeting links point at: this page's, and the public one. */
function siteHosts(): string[] {
  const hosts = [window.location.host];
  const site = publicEnv.NEXT_PUBLIC_APP_URL;
  if (site && URL.canParse(site)) hosts.push(new URL(site).host);
  return hosts;
}

/**
 * How the form looks where it's used:
 * - "row": Home, laid out as in Meet: one line with the button beside it. The field's
 *   label is for screen readers; on screen the placeholder says what to enter and the
 *   Join button next to it names the field's purpose (WCAG technique G167).
 * - "card": a visible `label` above the field and Join as the primary button (the
 *   sign-in page's "Joining a meeting?" card, and the meeting page's notices).
 * - "hero": the landing page's centrepiece: a large field with its label and a hint.
 */
type JoinFormVariant = "row" | "card" | "hero";

/**
 * "Enter a meeting ID or link" + Join. Accepts "123 456 7890", a meeting link or a
 * pasted invitation, and checks the meeting exists before opening it, so a mistake is
 * explained right here, with the text and focus still in the field. An ID's digits are
 * grouped as they're typed (formatTypedMeetingId); links and other text are left alone.
 */
export function JoinForm({
  variant,
  label,
  defaultValue = "",
}: {
  /** Defaults to "card" with a `label`, and "row" without. */
  variant?: JoinFormVariant;
  label?: string;
  defaultValue?: string;
}) {
  const look = variant ?? (label ? "card" : "row");
  const t = useTranslations("Join");
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const hintId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [problem, setProblem] = useState<Problem | null>(null);
  // Each new problem is announced, even the same one twice.
  const [told, setTold] = useState(0);
  const [checking, setChecking] = useState(false);

  function explain(next: Problem) {
    setProblem(next);
    setTold((count) => count + 1);
    field.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checking) return;
    const read = readMeetingInput(value, siteHosts());
    if (!read.ok) {
      explain(read.problem);
      return;
    }
    setChecking(true);
    const found = await lookUpMeeting(read.code);
    if (found === "open" || found === "unknown") {
      // Stays "checking" while the meeting's page loads.
      router.push(meetingPath(read.code, read.passcode));
      return;
    }
    setChecking(false);
    explain(found);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col", look === "hero" ? "gap-2" : "gap-2.5")}
      noValidate
    >
      <label
        htmlFor={inputId}
        className={cn(
          look === "row" && "sr-only",
          look === "card" && "text-[15px] font-semibold",
          look === "hero" && "text-[15px] font-bold",
        )}
      >
        {look === "hero" ? t("placeholder") : (label ?? t("label"))}
      </label>
      <div
        className={cn("flex", look === "hero" ? "gap-2 sm:gap-2.5" : "gap-2")}
      >
        <div className="relative flex min-w-0 flex-1">
          {look === "hero" ? (
            <Keyboard
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 hidden size-[22px] -translate-y-1/2 sm:block"
            />
          ) : null}
          <Input
            ref={field}
            id={inputId}
            placeholder={look === "hero" ? t("example") : t("placeholder")}
            value={value}
            onChange={(event) => {
              const input = event.currentTarget;
              const native = event.nativeEvent;
              const typed =
                "isComposing" in native && native.isComposing === true
                  ? // An input method still composing is left alone until it's done.
                    { value: input.value, caret: null }
                  : formatTypedMeetingId(
                      input.value,
                      input.selectionStart,
                      value,
                      "inputType" in native &&
                        typeof native.inputType === "string"
                        ? native.inputType
                        : undefined,
                    );
              if (typed.value !== input.value) {
                // Grouped as it's typed ("123 456 7890"). Set here, so React finds it in
                // place and the caret stays after the same digit.
                input.value = typed.value;
                if (typed.caret !== null) {
                  input.setSelectionRange(typed.caret, typed.caret);
                }
              }
              setValue(typed.value);
              setProblem(null);
            }}
            aria-invalid={problem ? true : undefined}
            aria-describedby={
              problem ? errorId : look === "hero" ? hintId : undefined
            }
            inputMode="text"
            autoComplete="off"
            className={cn(
              "min-w-0 flex-1",
              look === "card" && "h-11",
              look === "row" && "bg-card h-12 rounded-xl px-4 md:text-base",
              look === "hero" &&
                "bg-card h-[54px] rounded-xl px-3.5 font-mono text-[17px] tracking-[0.02em] sm:h-[60px] sm:rounded-[14px] sm:pl-[50px] sm:text-[19px] md:text-[19px]",
            )}
          />
        </div>
        <Button
          type="submit"
          variant={look === "row" ? "secondary" : "default"}
          size="lg"
          // The landing page's Join stays solid: pressed early, it says what to enter.
          isDisabled={look !== "hero" && value.trim() === ""}
          isPending={checking}
          className={cn(
            "gap-2",
            look === "card" && "h-11 px-5",
            look === "row" && "h-12 rounded-xl px-5 text-base font-semibold",
            look === "hero" &&
              "h-[54px] rounded-xl px-5 text-[17px] font-bold sm:h-[60px] sm:rounded-[14px] sm:px-[30px] sm:text-lg",
          )}
        >
          {checking ? (
            <LoaderCircle
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          {t("submit")}
        </Button>
      </div>
      {/* The landing page's hint, until a problem takes its place. */}
      {look === "hero" && !problem ? (
        <p
          id={hintId}
          className="text-muted-foreground text-[13px] leading-[1.4]"
        >
          {t("hint")}
        </p>
      ) : null}
      {problem ? (
        <p
          key={told}
          id={errorId}
          role="alert"
          className="text-destructive-text text-sm"
        >
          {t(`problems.${problem}`, {
            appName: publicEnv.NEXT_PUBLIC_APP_NAME,
          })}
        </p>
      ) : null}
    </form>
  );
}
