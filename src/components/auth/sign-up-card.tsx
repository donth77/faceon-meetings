"use client";

import { Clock3, Info, LoaderCircle, Mail, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useHumanCheck } from "@/components/human-check/use-human-check";
import { LegalConsent } from "@/components/legal/legal-links";
import { Button } from "@/components/ui/button";
import { sendVerificationEmail, signUp } from "@/lib/auth/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { authProblem, type AuthProblem } from "@/lib/auth/problems";
import { isEmailAddress } from "@/lib/email-address";
import { publicEnv } from "@/lib/env";
import { humanCheckFetchOptions, isHumanCheckError } from "@/lib/human-check";

import { AuthCard, AuthCardIcon, OrDivider } from "./auth-card";
import {
  focusFirstInvalid,
  FormNotice,
  PasswordField,
  TextField,
} from "./fields";
import { SocialSignIn } from "./social-sign-in";
import { verifyEmailCallback } from "./verify-callback";

const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

type FieldErrors = { name?: string; email?: string; password?: string };

/** After signing up with email: open the link we sent, or send it again. */
function CheckEmail({
  email,
  callbackURL,
  onDifferentEmail,
}: {
  email: string;
  callbackURL: string;
  onDifferentEmail: () => void;
}) {
  const t = useTranslations("Auth.checkEmail");
  const te = useTranslations("Auth.errors");
  const [resend, setResend] = useState<
    "idle" | "sending" | "sent" | "tooMany" | "checkFailed"
  >("idle");
  const check = useHumanCheck("account");

  async function sendAgain() {
    setResend("sending");
    const token = await check.take();
    if (token === null) {
      setResend("idle");
      return;
    }
    const { error } = await sendVerificationEmail({
      email,
      callbackURL,
      fetchOptions: humanCheckFetchOptions(token),
    });
    setResend(
      error?.status === 429
        ? "tooMany"
        : isHumanCheckError(error)
          ? "checkFailed"
          : "sent",
    );
  }

  return (
    <AuthCard
      title={t("title")}
      focusHeading
      icon={
        <AuthCardIcon tone="brand">
          <Mail className="size-[26px]" />
        </AuthCardIcon>
      }
    >
      <p className="text-[15px] leading-normal">
        {t.rich("body", {
          email,
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
      {resend === "sent" ? (
        <FormNotice icon={Mail} role="status">
          {t("resent")}
        </FormNotice>
      ) : resend === "tooMany" ? (
        <FormNotice icon={Clock3} tone="warning">
          {te("tooMany")}
        </FormNotice>
      ) : resend === "checkFailed" ? (
        <FormNotice icon={Info}>{te("humanCheck")}</FormNotice>
      ) : (
        <p className="text-muted-foreground text-[13px] leading-normal">
          {t("spam")}
        </p>
      )}
      {check.view}
      <Button
        variant="outline"
        onPress={() => void sendAgain()}
        isPending={resend === "sending"}
        className="h-[46px] rounded-xl text-[15px] font-semibold"
      >
        <RefreshCw className="size-[18px]" aria-hidden="true" />
        {t("resend")}
      </Button>
      <Button
        variant="link"
        onPress={onDifferentEmail}
        className="self-center text-sm font-semibold"
      >
        {t("differentEmail")}
      </Button>
    </AuthCard>
  );
}

/**
 * The sign-up card: Google and GitHub, or name, email and password. An email sign-up
 * must verify its address, so it ends on "Check your email". It looks the same whether
 * or not the email already has an account.
 */
export function SignUpCard({ emailEnabled }: { emailEnabled: boolean }) {
  const t = useTranslations("Auth");
  const searchParams = useSearchParams();
  const callbackURL = verifyEmailCallback(searchParams.get("next"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const check = useHumanCheck("account", emailEnabled);

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (name.trim() === "") found.name = t("errors.nameRequired");
    if (!isEmailAddress(email)) found.email = t("errors.invalidEmail");
    if (password.length < MIN_PASSWORD_LENGTH) {
      found.password = t("errors.passwordShort", { min: MIN_PASSWORD_LENGTH });
    }
    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const found = validate();
    setErrors(found);
    setProblem(null);
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(form);
      return;
    }

    setPending(true);
    const token = await check.take();
    if (token === null) {
      setPending(false);
      return;
    }
    const { error } = await signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      callbackURL,
      fetchOptions: humanCheckFetchOptions(token),
    });
    setPending(false);
    if (!error) {
      setSentTo(email.trim());
      return;
    }
    const kind = authProblem(error);
    if (kind === "passwordBreached") {
      setErrors({ password: t("errors.passwordBreached") });
    } else if (kind === "passwordShort") {
      setErrors({
        password: t("errors.passwordShort", { min: MIN_PASSWORD_LENGTH }),
      });
    } else if (kind === "invalidEmail") {
      setErrors({ email: t("errors.invalidEmail") });
    } else {
      setProblem(kind);
      return;
    }
    focusFirstInvalid(form);
  }

  if (sentTo) {
    return (
      <CheckEmail
        email={sentTo}
        callbackURL={callbackURL}
        onDifferentEmail={() => {
          setSentTo(null);
          setPassword("");
        }}
      />
    );
  }

  return (
    <AuthCard
      title={t("signUpTitle", { appName })}
      subtitle={t(emailEnabled ? "signUpSubtitle" : "signUpSubtitleSocial")}
    >
      <SocialSignIn mode="sign-up" />
      {emailEnabled ? (
        <>
          <OrDivider label={t("or")} />
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-3.5"
          >
            {problem === "tooMany" ? (
              <FormNotice icon={Clock3} tone="warning">
                {t("errors.tooMany")}
              </FormNotice>
            ) : problem ? (
              <FormNotice icon={Info}>
                {t(
                  problem === "humanCheck"
                    ? "errors.humanCheck"
                    : "errors.generic",
                )}
              </FormNotice>
            ) : null}
            <TextField
              label={t("name")}
              value={name}
              onChange={setName}
              autoComplete="name"
              error={errors.name}
              pending={pending}
            />
            <TextField
              label={t("email")}
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              error={errors.email}
              pending={pending}
            />
            <PasswordField
              label={t("password")}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              hint={t("passwordHint", { min: MIN_PASSWORD_LENGTH })}
              error={errors.password}
              pending={pending}
            />
            {check.view}
            <Button
              type="submit"
              isPending={pending}
              className="h-[50px] rounded-xl text-base font-semibold"
            >
              {pending ? (
                <LoaderCircle
                  className="size-5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : null}
              {pending ? t("creatingAccount") : t("createAccount")}
            </Button>
          </form>
        </>
      ) : null}
      <LegalConsent action="signUp" />
      <p className="border-t pt-3.5 text-[15px]">
        {t("haveAccount")}{" "}
        <Link
          href="/sign-in"
          className="text-primary font-bold underline-offset-4 hover:underline"
        >
          {t("signInLink")}
        </Link>
      </p>
    </AuthCard>
  );
}
