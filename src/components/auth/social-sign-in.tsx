"use client";

import { cn } from "cn";
import { Info, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth/client";
import { safeRedirectPath } from "@/lib/routes";

import { FormNotice } from "./fields";
import { GitHubIcon, GoogleIcon } from "./provider-icons";

export type AuthMode = "sign-in" | "sign-up";

type Provider = "google" | "github";

const PROVIDERS: ReadonlyArray<{
  id: Provider;
  name: string;
  Icon: typeof GoogleIcon;
  className: string;
}> = [
  {
    id: "google",
    name: "Google",
    Icon: GoogleIcon,
    className: "border-input bg-card text-foreground hover:bg-muted",
  },
  {
    // GitHub's mark on its own colors: black on light pages, light on dark ones.
    id: "github",
    name: "GitHub",
    Icon: GitHubIcon,
    className: "bg-foreground text-background hover:bg-foreground/85",
  },
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
    <div className="flex flex-col gap-2.5">
      {failed ? <FormNotice icon={Info}>{t("failed")}</FormNotice> : null}
      {PROVIDERS.map(({ id, name, Icon, className }) => (
        <Button
          key={id}
          variant="outline"
          className={cn(
            "h-[50px] w-full justify-center gap-3 rounded-xl text-base font-semibold",
            className,
          )}
          isDisabled={pending !== null}
          isPending={pending === id}
          onPress={() => void continueWith(id)}
        >
          {pending === id ? (
            <LoaderCircle
              className="size-5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Icon className="size-[22px]" />
          )}
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
