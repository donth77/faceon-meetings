"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { FormNotice } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { signIn, signOut } from "@/lib/auth/client";
import { publicEnv } from "@/lib/env";

import { allowDifferentEmail } from "./connect";

/** This page, to come back to after signing in. */
const here = () => `${window.location.pathname}${window.location.search}`;

/**
 * Google came back with an account whose email isn't this account's: connect it
 * anyway. The person confirms it first, and FaceOn allows it only within minutes of
 * signing in (lib/auth/linking-rules.ts), so the dialog asks them to sign in again when
 * theirs is older. `connect` goes back to Google, where they choose the account.
 */
export function ConnectAnyway({
  email,
  connect,
  className,
}: {
  /** This account's email. */
  email: string;
  connect: () => Promise<boolean>;
  className?: string;
}) {
  const t = useTranslations("GoogleCalendar.differentEmail");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signInFirst, setSignInFirst] = useState(false);

  async function go() {
    setBusy(true);
    const allowed = await allowDifferentEmail();
    if (allowed === "signInAgain") {
      setBusy(false);
      setSignInFirst(true);
      return;
    }
    // On its way to Google, unless it couldn't start.
    if (allowed === "ok" && (await connect())) return;
    setBusy(false);
    setOpen(false);
    toast.error(t("failed"));
  }

  async function signInAgain() {
    setBusy(true);
    const back = here();
    await signOut();
    window.location.assign(`/sign-in?next=${encodeURIComponent(back)}`);
  }

  return (
    <>
      <Button
        variant="outline"
        className={className}
        onPress={() => {
          setSignInFirst(false);
          setOpen(true);
        }}
      >
        {t("connectAnyway")}
      </Button>
      <ConfirmDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t("title")}
        description={t("body", { appName, email })}
        confirmLabel={signInFirst ? t("signInAgain") : t("continue")}
        cancelLabel={t("cancel")}
        isPending={busy}
        onConfirm={() => void (signInFirst ? signInAgain() : go())}
      >
        {signInFirst ? (
          <FormNotice icon={Info} tone="warning">
            {t("signInFirst", { appName })}
          </FormNotice>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

/**
 * The Google account already belongs to another FaceOn account: sign in to that one
 * with it instead (signing out of this one first), and come back here.
 */
export function SignInWithThatAccount({ className }: { className?: string }) {
  const t = useTranslations("GoogleCalendar.differentEmail");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      className={className}
      isPending={busy}
      onPress={async () => {
        setBusy(true);
        const back = window.location.pathname;
        await signOut();
        const { error } = await signIn.social({
          provider: "google",
          callbackURL: back,
        });
        if (error) {
          setBusy(false);
          toast.error(t("failed"));
        }
      }}
    >
      {t("otherAccount")}
    </Button>
  );
}
