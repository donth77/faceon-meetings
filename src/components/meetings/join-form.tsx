"use client";

import { cn } from "cn";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicEnv } from "@/lib/env";
import {
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
 * "Enter a meeting ID or link" + Join. Accepts "123 456 7890", a meeting link or a
 * pasted invitation, and checks the meeting exists before opening it, so a mistake is
 * explained right here, with the text and focus still in the field.
 *
 * Without a `label` it's the row on Home and the landing page, laid out as in Meet: one
 * line with the button beside it. The field's label is for screen readers; on screen the
 * placeholder says what to enter and the Join button next to it names the field's purpose
 * (WCAG technique G167). With a `label`, it shows above the field and Join is the primary
 * button (the sign-in page's "Joining a meeting?" card, and the meeting page's notices).
 */
export function JoinForm({
  label,
  defaultValue = "",
}: {
  label?: string;
  defaultValue?: string;
}) {
  const t = useTranslations("Join");
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5" noValidate>
      <label
        htmlFor={inputId}
        className={label ? "text-[15px] font-semibold" : "sr-only"}
      >
        {label ?? t("label")}
      </label>
      <div className="flex gap-2">
        <Input
          ref={field}
          id={inputId}
          placeholder={t("placeholder")}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setProblem(null);
          }}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? errorId : undefined}
          inputMode="text"
          autoComplete="off"
          className={cn(
            "min-w-0 flex-1",
            label ? "h-11" : "bg-card h-12 rounded-xl px-4 md:text-base",
          )}
        />
        <Button
          type="submit"
          variant={label ? "default" : "secondary"}
          size="lg"
          isDisabled={value.trim() === ""}
          isPending={checking}
          className={cn(
            "gap-2",
            label
              ? "h-11 px-5"
              : "h-12 rounded-xl px-5 text-base font-semibold",
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
