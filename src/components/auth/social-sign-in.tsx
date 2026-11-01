"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth/client";
import { safeRedirectPath } from "@/lib/routes";

import { GitHubIcon, GoogleIcon } from "./provider-icons";

export type AuthMode = "sign-in" | "sign-up";

type Provider = "google" | "github";

const PROVIDERS: ReadonlyArray<{
  id: Provider;
  name: string;
  Icon: typeof GoogleIcon;
}> = [
  { id: "google", name: "Google", Icon: GoogleIcon },
  { id: "github", name: "GitHub", Icon: GitHubIcon },
];

/**
 * "Continue with Google / GitHub". Sign-in and sign-up are the same OAuth flow: the first
 * sign-in creates the account. After it, people return to the page they came for (?next=).
 */
export function SocialSignIn({ mode }: { mode: AuthMode }) {
  const t = useTranslations("Auth");
  const searchParams = useSearchParams();
  const [pending, setPending] = useState<Provider | null>(null);
  const [failed, setFailed] = useState(searchParams.has("error"));

  async function continueWith(provider: Provider) {
    setPending(provider);
    setFailed(false);
    const { error } = await signIn.social({
      provider,
      callbackURL: safeRedirectPath(searchParams.get("next")),
      errorCallbackURL: `/${mode}?error=1`,
    });
    if (error) {
      setPending(null);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {failed ? (
        <p
          role="alert"
          className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm"
        >
          {t("failed")}
        </p>
      ) : null}
      {PROVIDERS.map(({ id, name, Icon }) => (
        <Button
          key={id}
          variant="outline"
          size="lg"
          className="w-full justify-center gap-3"
          isDisabled={pending !== null}
          isPending={pending === id}
          onPress={() => continueWith(id)}
        >
          <Icon className="size-5" />
          {pending === id
            ? t("continuing", { provider: name })
            : t(mode === "sign-up" ? "signUpWith" : "continueWith", {
                provider: name,
              })}
        </Button>
      ))}
    </div>
  );
}
