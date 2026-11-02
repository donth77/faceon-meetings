"use client";

import { ChevronLeft, Clock3, Info, LoaderCircle, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useHumanCheck } from "@/components/human-check/use-human-check";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/auth/client";
import { isEmailAddress } from "@/lib/email-address";
import { publicEnv } from "@/lib/env";
import { humanCheckFetchOptions, isHumanCheckError } from "@/lib/human-check";

import { AuthCard } from "./auth-card";
import { focusFirstInvalid, FormNotice, TextField } from "./fields";

/**
 * "Reset your password": sends a reset link. The reply is the same whether or not the
 * email has an account, so nobody can use this to find out who signed up.
 */
export function ForgotPasswordCard() {
  const t = useTranslations("Auth");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [state, setState] = useState<
    "idle" | "sending" | "sent" | "tooMany" | "checkFailed"
  >("idle");
  const [sentTo, setSentTo] = useState("");
  const check = useHumanCheck("account");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEmailAddress(email)) {
      setEmailError(t("errors.invalidEmail"));
      focusFirstInvalid(event.currentTarget);
      return;
    }
    setEmailError(null);
    setState("sending");
    const token = await check.take();
    if (token === null) {
      setState("idle");
      return;
    }
    const { error } = await requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
      fetchOptions: humanCheckFetchOptions(token),
    });
    setSentTo(email.trim());
    setState(
      error?.status === 429
        ? "tooMany"
        : isHumanCheckError(error)
          ? "checkFailed"
          : "sent",
    );
  }

  return (
    <AuthCard
      title={t("forgot.title")}
      subtitle={t("forgot.subtitle", {
        appName: publicEnv.NEXT_PUBLIC_APP_NAME,
      })}
    >
      {state === "sent" ? (
        <FormNotice icon={Mail} role="status">
          {t("forgot.sent", { email: sentTo })}
        </FormNotice>
      ) : state === "tooMany" ? (
        <FormNotice icon={Clock3} tone="warning">
          {t("errors.tooMany")}
        </FormNotice>
      ) : state === "checkFailed" ? (
        <FormNotice icon={Info}>{t("errors.humanCheck")}</FormNotice>
      ) : null}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-3.5"
      >
        <TextField
          label={t("email")}
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          error={emailError}
          pending={state === "sending"}
        />
        {check.view}
        <Button
          type="submit"
          variant={state === "sent" ? "outline" : "default"}
          isPending={state === "sending"}
          isDisabled={email.trim() === ""}
          className="h-[50px] rounded-xl text-base font-semibold"
        >
          {state === "sending" ? (
            <LoaderCircle
              className="size-5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          {state === "sent" ? t("forgot.sendAgain") : t("forgot.send")}
        </Button>
      </form>
      <Link
        href="/sign-in"
        className="text-primary inline-flex items-center gap-1 self-center rounded text-sm font-semibold underline-offset-4 hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("forgot.back")}
      </Link>
    </AuthCard>
  );
}
