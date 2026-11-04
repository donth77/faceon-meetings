"use client";

import { Link2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, INPUT } from "@/components/ui/form-fields";
import { Pager } from "@/components/ui/pager";
import { isEmailAddress } from "@/lib/email-address";
import { publicEnv } from "@/lib/env";
import {
  addApprovedHostAction,
  removeApprovedHostAction,
  sendInvitationAction,
  type InviteResult,
} from "@/lib/hosting/admin-actions";
import {
  hostStatus,
  inviteLink,
  INVITES_PER_ADDRESS,
  INVITES_PER_ADMIN_PER_DAY,
  type AccountState,
} from "@/lib/hosting/invites";
import type { ListPage } from "@/lib/pagination";

import { AdminCard } from "./admin-card";
import { useFocusAfterRemoval } from "./use-focus-after-removal";
import { useWhen } from "./use-when";

type Host = {
  email: string;
  source: "settings" | "admin";
  account: AccountState;
  addedBy: string | null;
  createdAt: string | null;
  note: string | null;
  invitedAt: string | null;
  inviteCount: number;
};

/**
 * Settings → Admin → Approved hosts: add an address (before or after its owner signs up), or move
 * one back to demo meetings. Addresses from the operator's settings are only listed. The list is
 * paged (`?hosts=`), and `hosts` is the page shown.
 *
 * Inviting someone who hasn't signed up: **Copy invite link** (sign-up with their address filled
 * in, sent however the admin likes, costing nothing) is the way offered first. FaceOn emails an
 * invitation only when the admin chooses to, when email is set up (`emailEnabled`), since each
 * one uses the free plan's daily emails (lib/hosting/invites.ts has the limits).
 */
export function ApprovedHosts({
  hosts,
  page,
  full,
  site,
  emailEnabled,
}: {
  hosts: Host[];
  page: ListPage;
  full: { people: number; minutes: number };
  /** This copy's address, for invite links. */
  site: string;
  emailEnabled: boolean;
}) {
  const t = useTranslations("Admin.hosts");
  const admin = useTranslations("Admin");
  const router = useRouter();
  const when = useWhen();
  const heading = useRef<HTMLHeadingElement>(null);
  const [demoting, setDemoting] = useState<Host | null>(null);
  const [inviting, setInviting] = useState<Host | null>(null);
  const [shownLink, setShownLink] = useState<{
    email: string;
    link: string;
  } | null>(null);
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

  /** Says how an invitation email went; true when it went. */
  function invitationOutcome(email: string, result: InviteResult | string) {
    switch (result) {
      case "sent":
        toast.success(t("inviteSent", { email }));
        return true;
      case "hasAccount":
        toast(t("inviteHasAccount", { email }));
        return false;
      case "tooSoon":
        toast.error(t("inviteTooSoon", { email }));
        return false;
      case "tooMany":
        toast.error(t("inviteTooMany", { email, count: INVITES_PER_ADDRESS }));
        return false;
      case "dailyCap":
        toast.error(t("inviteDailyCap", { count: INVITES_PER_ADMIN_PER_DAY }));
        return false;
      case "noEmail":
        toast.error(
          t("inviteNoEmail", { appName: publicEnv.NEXT_PUBLIC_APP_NAME }),
        );
        return false;
      case "notListed":
      case "failed":
        toast.error(t("inviteFailed", { email }));
        return false;
      default:
        refused(result);
        return false;
    }
  }

  async function copyLink(host: Host) {
    const link = inviteLink(site, host.email);
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("linkCopied", { email: host.email }));
    } catch {
      // The browser wouldn't copy: show the link to copy by hand.
      setShownLink({ email: host.email, link });
    }
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
      <AddHost
        emailEnabled={emailEnabled}
        onAdded={() => router.refresh()}
        onRefused={refused}
        onInvitation={invitationOutcome}
      />
      <Pager label={t("pages")} param="hosts" page={page}>
        {hosts.length === 0 ? (
          <p className="text-muted-foreground text-[15px]">{t("none")}</p>
        ) : (
          <ul className="flex flex-col divide-y border-t">
            {hosts.map((host) => {
              const status = hostStatus({
                account: host.account,
                invitedAt: host.invitedAt ? new Date(host.invitedAt) : null,
              });
              const canCopy = host.account === "none";
              const canEmail =
                emailEnabled &&
                host.source === "admin" &&
                host.account === "none" &&
                host.inviteCount < INVITES_PER_ADDRESS;
              return (
                <li
                  key={host.email}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3.5 last:pb-0"
                >
                  <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
                    <span className="font-medium break-all">{host.email}</span>
                    <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                      <Chip tone={status === "joined" ? "brand" : "neutral"}>
                        {status === "joined"
                          ? t("statusJoined")
                          : status === "invited" && host.invitedAt
                            ? t("statusInvited", {
                                date: when(host.invitedAt),
                              })
                            : t("statusApproved")}
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
                  {canCopy || canEmail || host.source === "admin" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {canCopy ? (
                        <Button
                          onPress={() => void copyLink(host)}
                          aria-label={t("copyLinkLabel", { email: host.email })}
                        >
                          <Link2 aria-hidden="true" />
                          {t("copyLink")}
                        </Button>
                      ) : null}
                      {canEmail ? (
                        <Button
                          variant="outline"
                          onPress={() => setInviting(host)}
                          aria-label={t(
                            host.invitedAt
                              ? "resendInviteLabel"
                              : "sendInviteLabel",
                            { email: host.email },
                          )}
                        >
                          <Mail aria-hidden="true" />
                          {t(host.invitedAt ? "resendInvite" : "sendInvite")}
                        </Button>
                      ) : null}
                      {host.source === "admin" ? (
                        <Button
                          variant="outline"
                          onPress={() => setDemoting(host)}
                          aria-label={t("removeLabel", { email: host.email })}
                        >
                          {t("remove")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
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
      {inviting ? (
        <SendInvitation
          host={inviting}
          onClose={() => setInviting(null)}
          onDone={(result) => {
            setInviting(null);
            invitationOutcome(inviting.email, result);
            router.refresh();
          }}
        />
      ) : null}
      {shownLink ? (
        <Dialog
          isOpen
          onOpenChange={(open) => {
            if (!open) setShownLink(null);
          }}
          closeLabel={t("close")}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {t("linkTitle", { email: shownLink.email })}
            </DialogTitle>
            <DialogDescription>{t("linkHelp")}</DialogDescription>
          </DialogHeader>
          <input
            readOnly
            value={shownLink.link}
            aria-label={t("linkTitle", { email: shownLink.email })}
            onFocus={(event) => event.currentTarget.select()}
            className={INPUT}
          />
          <DialogFooter>
            <Button onPress={() => setShownLink(null)}>{t("close")}</Button>
          </DialogFooter>
        </Dialog>
      ) : null}
    </AdminCard>
  );
}

/** Email an approved address its invitation, with an optional message from the admin. */
function SendInvitation({
  host,
  onClose,
  onDone,
}: {
  host: Host;
  onClose: () => void;
  onDone: (result: InviteResult | string) => void;
}) {
  const t = useTranslations("Admin.hosts");
  const messageId = useId();
  const [message, setMessage] = useState("");
  const [sending, startSending] = useTransition();

  function send() {
    startSending(async () => {
      const result = await sendInvitationAction(
        host.email,
        message.trim() || null,
      ).catch(() => "failed" as const);
      onDone(result);
    });
  }

  return (
    <ConfirmDialog
      isOpen
      onClose={onClose}
      title={t("inviteTitle", { email: host.email })}
      description={t("inviteBody", {
        appName: publicEnv.NEXT_PUBLIC_APP_NAME,
      })}
      confirmLabel={t("send")}
      cancelLabel={t("cancel")}
      isPending={sending}
      onConfirm={send}
    >
      <Field
        label={t("messageLabel")}
        optional={t("messageOptional")}
        htmlFor={messageId}
      >
        <textarea
          id={messageId}
          maxLength={500}
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className={`${INPUT} h-auto py-2.5`}
        />
      </Field>
    </ConfirmDialog>
  );
}

/** Approve an address: their meetings are full from their next one. */
function AddHost({
  emailEnabled,
  onAdded,
  onRefused,
  onInvitation,
}: {
  emailEnabled: boolean;
  onAdded: () => void;
  onRefused: (result: string) => void;
  /** Says how an invitation email went. */
  onInvitation: (email: string, result: InviteResult) => boolean;
}) {
  const t = useTranslations("Admin.hosts");
  const emailId = useId();
  const noteId = useId();
  const helpId = useId();
  const errorId = useId();
  const inviteHelpId = useId();
  const messageId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  // Emailing is a choice the admin makes, never the default: each email uses the free
  // plan's daily allowance, and the invite link costs nothing.
  const [sendInvitation, setSendInvitation] = useState(false);
  const [message, setMessage] = useState("");
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
      const result = await addApprovedHostAction({
        email: address,
        note: note.trim(),
        sendInvitation: emailEnabled && sendInvitation,
        message: sendInvitation ? message.trim() : "",
      }).catch(() => "failed" as const);
      const lowered = address.toLowerCase();
      if (typeof result === "string") {
        if (result === "invalid") {
          setProblem(t("invalidEmail"));
          field.current?.focus();
        } else {
          onRefused(result);
        }
        return;
      }
      if (result.added === "added") {
        if (result.invitation === "sent") {
          toast.success(t("addedInvited", { email: lowered }));
        } else if (result.invitation === "hasAccount") {
          toast.success(t("addedHasAccount", { email: lowered }));
        } else {
          toast.success(t("added", { email: lowered }));
          if (result.invitation) onInvitation(lowered, result.invitation);
        }
        setEmail("");
        setNote("");
        setSendInvitation(false);
        setMessage("");
        onAdded();
      } else {
        setProblem(
          t(result.added === "exists" ? "exists" : "settingsAlready", {
            email: lowered,
          }),
        );
        field.current?.focus();
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
      {emailEnabled ? (
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2.5 text-[15px]">
            <input
              type="checkbox"
              checked={sendInvitation}
              aria-describedby={inviteHelpId}
              onChange={(event) => setSendInvitation(event.target.checked)}
              className="accent-primary focus-visible:focus-ring mt-0.5 size-[18px] shrink-0 rounded"
            />
            {t("emailInvite")}
          </label>
          <p
            id={inviteHelpId}
            className="text-muted-foreground ml-7 text-[13px] leading-normal"
          >
            {t("emailInviteHelp", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
          </p>
          {sendInvitation ? (
            <Field
              label={t("messageLabel")}
              optional={t("messageOptional")}
              htmlFor={messageId}
              className="ml-7"
            >
              <textarea
                id={messageId}
                maxLength={500}
                rows={2}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className={`${INPUT} h-auto py-2.5`}
              />
            </Field>
          ) : null}
        </div>
      ) : null}
      {problem ? (
        <p id={errorId} role="alert" className="text-destructive-text text-sm">
          {problem}
        </p>
      ) : null}
    </form>
  );
}
