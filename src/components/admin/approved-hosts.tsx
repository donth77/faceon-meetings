"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, INPUT } from "@/components/ui/form-fields";
import { Pager } from "@/components/ui/pager";
import { isEmailAddress } from "@/lib/email-address";
import { publicEnv } from "@/lib/env";
import {
  addApprovedHostAction,
  removeApprovedHostAction,
} from "@/lib/hosting/admin-actions";
import type { ListPage } from "@/lib/pagination";

import { AdminCard } from "./admin-card";
import { useFocusAfterRemoval } from "./use-focus-after-removal";
import { useWhen } from "./use-when";

type Host = {
  email: string;
  source: "settings" | "admin";
  hasAccount: boolean;
  addedBy: string | null;
  createdAt: string | null;
  note: string | null;
};

/**
 * Settings → Admin → Approved hosts: add an address (before or after its owner signs up), or move
 * one back to demo meetings. Addresses from the operator's settings are only listed. The list is
 * paged (`?hosts=`), and `hosts` is the page shown.
 */
export function ApprovedHosts({
  hosts,
  page,
  full,
}: {
  hosts: Host[];
  page: ListPage;
  full: { people: number; minutes: number };
}) {
  const t = useTranslations("Admin.hosts");
  const admin = useTranslations("Admin");
  const router = useRouter();
  const when = useWhen();
  const heading = useRef<HTMLHeadingElement>(null);
  const [demoting, setDemoting] = useState<Host | null>(null);
  const [removing, startRemoving] = useTransition();
  const rowGoing = useFocusAfterRemoval(heading, hosts);

  function refused(result: string) {
    toast.error(
      admin(
        result === "notAllowed"
          ? "notAllowed"
          : result === "tooManyTries"
            ? "tooManyTries"
            : "failed",
      ),
    );
  }

  function demote(host: Host) {
    startRemoving(async () => {
      const result = await removeApprovedHostAction(host.email).catch(
        () => "failed" as const,
      );
      setDemoting(null);
      if (result === "removed" || result === "missing") {
        toast.success(t("removed", { email: host.email }));
      } else if (result === "settings") {
        toast(t("settingsOnly", { email: host.email }));
      } else {
        refused(result);
      }
      // The row goes: keep focus in the section.
      heading.current?.focus();
      rowGoing();
      router.refresh();
    });
  }

  const fromSettings = hosts.some((host) => host.source === "settings");

  return (
    <AdminCard
      title={t("title")}
      headingRef={heading}
      description={t("help", full)}
    >
      <AddHost onAdded={() => router.refresh()} onRefused={refused} />
      <Pager label={t("pages")} param="hosts" page={page}>
        {hosts.length === 0 ? (
          <p className="text-muted-foreground text-[15px]">{t("none")}</p>
        ) : (
          <ul className="flex flex-col divide-y border-t">
            {hosts.map((host) => (
              <li
                key={host.email}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3.5 last:pb-0"
              >
                <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
                  <span className="font-medium break-all">{host.email}</span>
                  <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                    <Chip>
                      {host.hasAccount ? admin("account") : admin("noAccount")}
                    </Chip>
                    {host.source === "settings"
                      ? t("fromSettings")
                      : host.createdAt
                        ? host.addedBy
                          ? t("addedBy", {
                              name: host.addedBy,
                              date: when(host.createdAt),
                            })
                          : t("addedOn", { date: when(host.createdAt) })
                        : null}
                  </span>
                  {host.note ? (
                    <span className="text-muted-foreground text-sm whitespace-pre-wrap">
                      {host.note}
                    </span>
                  ) : null}
                </div>
                {host.source === "admin" ? (
                  <Button
                    variant="outline"
                    onPress={() => setDemoting(host)}
                    aria-label={t("removeLabel", { email: host.email })}
                  >
                    {t("remove")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Pager>
      {fromSettings ? (
        <p className="text-muted-foreground text-[13px] leading-normal">
          {t("settingsHelp", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
        </p>
      ) : null}
      {demoting ? (
        <ConfirmDialog
          isOpen
          onClose={() => setDemoting(null)}
          title={t("removeTitle", { email: demoting.email })}
          description={t("removeBody")}
          confirmLabel={t("remove")}
          cancelLabel={t("cancel")}
          destructive
          isPending={removing}
          onConfirm={() => demote(demoting)}
        />
      ) : null}
    </AdminCard>
  );
}

/** Approve an address: their meetings are full from their next one. */
function AddHost({
  onAdded,
  onRefused,
}: {
  onAdded: () => void;
  onRefused: (result: string) => void;
}) {
  const t = useTranslations("Admin.hosts");
  const emailId = useId();
  const noteId = useId();
  const helpId = useId();
  const errorId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!isEmailAddress(address)) {
      setProblem(t("invalidEmail"));
      field.current?.focus();
      return;
    }
    startAdding(async () => {
      const result = await addApprovedHostAction(address, note.trim()).catch(
        () => "failed" as const,
      );
      if (result === "added") {
        toast.success(t("added", { email: address.toLowerCase() }));
        setEmail("");
        setNote("");
        onAdded();
      } else if (result === "exists" || result === "settings") {
        setProblem(
          t(result === "exists" ? "exists" : "settingsAlready", {
            email: address.toLowerCase(),
          }),
        );
        field.current?.focus();
      } else if (result === "invalid") {
        setProblem(t("invalidEmail"));
        field.current?.focus();
      } else {
        onRefused(result);
      }
    });
  }

  return (
    <form onSubmit={add} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-wrap items-end gap-3">
        <Field
          label={t("addLabel")}
          htmlFor={emailId}
          className="flex-[1_1_240px]"
        >
          <input
            ref={field}
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            placeholder="name@example.com"
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `${helpId} ${errorId}` : helpId}
            onChange={(event) => {
              setEmail(event.target.value);
              setProblem(null);
            }}
            className={INPUT}
          />
        </Field>
        <Field
          label={t("noteLabel")}
          optional={t("optional")}
          htmlFor={noteId}
          className="flex-[1_1_200px]"
        >
          <input
            id={noteId}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={INPUT}
          />
        </Field>
        <Button type="submit" isPending={adding} className="h-[46px] px-5">
          {t("add")}
        </Button>
      </div>
      <p id={helpId} className="text-muted-foreground text-[13px]">
        {t("addHelp")}
      </p>
      {problem ? (
        <p id={errorId} role="alert" className="text-destructive-text text-sm">
          {problem}
        </p>
      ) : null}
    </form>
  );
}
