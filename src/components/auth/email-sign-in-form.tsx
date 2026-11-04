"use client";

import { Clock3, Info, LoaderCircle, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth/client";
import { authProblem, type AuthProblem } from "@/lib/auth/problems";
import { isEmailAddress } from "@/lib/email-address";
import { linkParam } from "@/lib/link-params";
import { safeRedirectPath } from "@/lib/routes";

import {
  focusFirstInvalid,
  FormNotice,
  PasswordField,
  TextField,
} from "./fields";

const forgotLinkClass =
  "text-primary rounded text-sm font-semibold underline-offset-4 hover:underline";

/** Email and password sign-in. Problems show above the form, worded without blame. */
export function EmailSignInForm() {
  const t = useTranslations("Auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEmailAddress(email)) {
      setEmailError(t("errors.invalidEmail"));
      focusFirstInvalid(event.currentTarget);
      return;
    }
    setEmailError(null);
    setProblem(null);
    setPending(true);
    // Better Auth sends the browser here after signing in (and points a fresh
    // verification link here if the email isn't verified yet).
    const { error } = await signIn.email({
      email: email.trim(),
      password,
      callbackURL: safeRedirectPath(linkParam("next")),
    });
    if (error) {
      setPending(false);
      setProblem(authProblem(error));
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
      {problem === "wrongCredentials" ? (
        <FormNotice icon={Info}>
          {t.rich("errors.wrongCredentials", {
            link: (chunks) => (
              <Link href="/forgot-password" className={forgotLinkClass}>
                {chunks}
              </Link>
            ),
          })}
        </FormNotice>
      ) : problem === "notVerified" ? (
        <FormNotice icon={MailCheck}>
          {t("errors.notVerified", { email: email.trim() })}
        </FormNotice>
      ) : problem === "tooMany" ? (
        <FormNotice icon={Clock3} tone="warning">
          {t("errors.tooMany")}
        </FormNotice>
      ) : problem ? (
        <FormNotice icon={Info}>{t("errors.generic")}</FormNotice>
      ) : null}

      <TextField
        label={t("email")}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        error={emailError}
        pending={pending}
      />
      <PasswordField
        label={t("password")}
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        pending={pending}
        aside={
          <Link href="/forgot-password" className={forgotLinkClass}>
            {t("forgotPassword")}
          </Link>
        }
      />
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
        {pending ? t("signingIn") : t("signInButton")}
      </Button>
    </form>
  );
}
