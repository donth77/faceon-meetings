"use client";

import { Check, Clock3, Info, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { resetPassword } from "@/lib/auth/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { authProblem } from "@/lib/auth/problems";
import { publicEnv } from "@/lib/env";

import { AuthCard, AuthCardIcon } from "./auth-card";
import { FormNotice, PasswordField } from "./fields";

type State = "idle" | "saving" | "done" | "expired" | "tooMany" | "failed";

const bigButton = "h-[50px] rounded-xl text-base font-semibold";

/**
 * "Choose a new password", from the link in a reset email. Saving signs the account out
 * everywhere; then the person signs in with the new password.
 */
export function ResetPasswordCard() {
  const t = useTranslations("Auth");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>(
    !token || searchParams.has("error") ? "expired" : "idle",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>(
    {},
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrors({
        password: t("errors.passwordShort", { min: MIN_PASSWORD_LENGTH }),
      });
      return;
    }
    if (confirm !== password) {
      setErrors({ confirm: t("errors.passwordMismatch") });
      return;
    }
    if (!token) return;
    setErrors({});
    setState("saving");
    const { error } = await resetPassword({ newPassword: password, token });
    if (!error) {
      setState("done");
      return;
    }
    const kind = authProblem(error);
    if (kind === "passwordBreached" || kind === "passwordShort") {
      setErrors({
        password:
          kind === "passwordBreached"
            ? t("errors.passwordBreached")
            : t("errors.passwordShort", { min: MIN_PASSWORD_LENGTH }),
      });
      setState("idle");
    } else if (kind === "invalidToken") {
      setState("expired");
    } else {
      setState(kind === "tooMany" ? "tooMany" : "failed");
    }
  }

  if (state === "expired") {
    return (
      <AuthCard
        title={t("reset.expiredTitle")}
        subtitle={t("reset.expiredBody")}
      >
        <LinkButton href="/forgot-password" className={bigButton}>
          {t("reset.requestNew")}
        </LinkButton>
      </AuthCard>
    );
  }

  if (state === "done") {
    return (
      <AuthCard
        title={t("reset.doneTitle")}
        subtitle={t("reset.doneBody")}
        icon={
          <AuthCardIcon tone="success">
            <Check className="size-7" />
          </AuthCardIcon>
        }
      >
        <LinkButton href="/sign-in" className={bigButton}>
          {t("reset.signIn")}
        </LinkButton>
      </AuthCard>
    );
  }

  const saving = state === "saving";
  return (
    <AuthCard title={t("reset.title")}>
      {state === "tooMany" ? (
        <FormNotice icon={Clock3} tone="warning">
          {t("errors.tooMany")}
        </FormNotice>
      ) : state === "failed" ? (
        <FormNotice icon={Info}>{t("errors.generic")}</FormNotice>
      ) : null}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-3.5"
      >
        <PasswordField
          label={t("newPassword")}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={t("passwordHint", { min: MIN_PASSWORD_LENGTH })}
          error={errors.password}
          disabled={saving}
        />
        <PasswordField
          label={t("confirmPassword")}
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={errors.confirm}
          disabled={saving}
        />
        <Button type="submit" isPending={saving} className={bigButton}>
          {saving ? (
            <LoaderCircle
              className="size-5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          {saving ? t("reset.saving") : t("reset.save")}
        </Button>
      </form>
      <p className="text-muted-foreground text-[13px] leading-normal">
        {t("reset.note", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
      </p>
    </AuthCard>
  );
}
