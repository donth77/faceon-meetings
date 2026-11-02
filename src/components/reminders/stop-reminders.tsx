"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AuthCard, AuthCardIcon } from "@/components/auth/auth-card";
import { Button, LinkButton } from "@/components/ui/button";
import { stopEmailRemindersAction } from "@/lib/reminders/actions";

const bigButton = "h-[50px] rounded-xl text-base font-semibold";

/** The link in a reminder email: asks once, then reminder emails are off. */
export function StopReminders({ token }: { token: string }) {
  const t = useTranslations("Unsubscribe");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <AuthCard
        title={t("doneTitle")}
        subtitle={t("doneBody")}
        focusHeading
        icon={
          <AuthCardIcon tone="success">
            <Check className="size-7" />
          </AuthCardIcon>
        }
      >
        <LinkButton
          href="/settings/notifications"
          variant="outline"
          className={bigButton}
        >
          {t("settings")}
        </LinkButton>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} subtitle={t("body")}>
      <Button
        isPending={pending}
        className={bigButton}
        onPress={() =>
          startTransition(async () => {
            const ok = await stopEmailRemindersAction(token).catch(() => false);
            if (ok) setDone(true);
            else toast.error(t("failed"));
          })
        }
      >
        {t("stop")}
      </Button>
    </AuthCard>
  );
}
