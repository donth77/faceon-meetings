"use client";

import {
  CalendarCheck,
  CalendarPlus,
  ExternalLink,
  Info,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FormNotice } from "@/components/auth/fields";
import {
  addAddonInBrowser,
  addonRequest,
  CALENDAR_SETTINGS_ROUTE,
  connectInPage,
} from "@/components/google-calendar/connect";
import {
  ConnectAnyway,
  SignInWithThatAccount,
} from "@/components/google-calendar/different-email";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NewTabNote } from "@/components/ui/new-tab-note";
import {
  APPS_SCRIPT_SETTINGS_URL,
  consentProblem,
  GOOGLE_CALENDAR_URL,
  scriptEditorUrl,
  type AddonProblem,
  type AddonReply,
  type AddonSetup,
  type ConsentProblem,
} from "@/lib/addon/google/setup-shared";
import { publicEnv } from "@/lib/env";
import { GOOGLE_SCRIPT_SCOPE } from "@/lib/google-calendar/shared";

import { ConnectionState, OUTLINE } from "./connection-state";
import { SettingsCard } from "./settings-nav";

/** Back from Google's consent screen for the add-on: `?addon=add|update`, maybe `&error=`. */
export type AddonReturn = {
  action: "add" | "update" | null;
  error: string | null;
};

type Action = "add" | "update";
type Problem = {
  kind: AddonProblem | ConsentProblem;
  /** Where to turn the Apps Script API on (admins only). */
  consoleUrl?: string;
};

/** Problems the person can do something about by trying again. */
const RETRY = new Set<Problem["kind"]>([
  "consent",
  "denied",
  "emailMismatch",
  "userApiOff",
  "failed",
]);

/**
 * Settings → Calendar → FaceOn in Google Calendar and Gmail. FaceOn makes the person
 * their own copy of its add-on in their Google account, after Google's consent (here, or
 * in the browser from the desktop app); then they install it in Google's Apps Script
 * editor, and it connects itself the first time it's used. The card looks again when
 * the window comes back to the front, which is how it learns that.
 */
export function AddonSettings({
  initial,
  email,
  returned,
}: {
  initial: AddonSetup;
  email: string;
  returned: AddonReturn;
}) {
  const t = useTranslations("AddonSetup");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const [addon, setAddon] = useState(initial);
  const [busy, setBusy] = useState<Action | "remove" | null>(
    returned.action && !returned.error ? returned.action : null,
  );
  const [problem, setProblem] = useState<Problem | null>(
    returned.error ? { kind: consentProblem(returned.error) } : null,
  );
  const [lastAction, setLastAction] = useState<Action>(
    returned.action ?? "add",
  );
  /** The project just removed, for the note on taking it out of Google too. */
  const [removed, setRemoved] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const openScript = useRef<HTMLAnchorElement>(null);
  const removedNote = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<"openScript" | "removedNote" | null>(null);
  /** Counts changes, so an answer about an earlier state doesn't undo a later one. */
  const changes = useRef(0);
  const started = useRef(false);

  function apply(reply: AddonReply) {
    setAddon(reply.addon);
    setProblem(
      reply.problem
        ? { kind: reply.problem, consoleUrl: reply.consoleUrl }
        : null,
    );
  }

  /** Adds or updates it, once Google allows it. */
  function run(action: Action) {
    setBusy(action);
    setLastAction(action);
    setProblem(null);
    setRemoved(null);
    void send(action);
  }

  /** Asks FaceOn to add or update it, and shows what came of it. */
  async function send(action: Action) {
    changes.current += 1;
    const reply = await addonRequest("POST", action);
    setBusy(null);
    if (!reply) {
      setProblem({ kind: "failed" });
      return;
    }
    apply(reply);
    if (reply.problem) return;
    if (action === "update") toast.success(t("updated"));
    else focusAfter.current = "openScript";
  }

  /** Google's consent first: in this page, or the browser from the desktop app. */
  async function allow(action: Action) {
    setLastAction(action);
    setProblem(null);
    const inBrowser = addAddonInBrowser(action);
    if (inBrowser) {
      toast(t("inBrowser"));
      const done = await inBrowser;
      if (done) {
        changes.current += 1;
        setAddon(done);
      }
      return;
    }
    setBusy(action);
    const going = await connectInPage({
      back: `${CALENDAR_SETTINGS_ROUTE}?addon=${action}`,
      loginHint: email,
      scope: GOOGLE_SCRIPT_SCOPE,
    });
    if (!going) {
      setBusy(null);
      setProblem({ kind: "failed" });
    }
  }

  function add() {
    if (addon.status === "none" && addon.granted) run("add");
    else void allow("add");
  }

  async function remove() {
    const scriptId = "scriptId" in addon ? addon.scriptId : null;
    changes.current += 1;
    setBusy("remove");
    const reply = await addonRequest("DELETE");
    setBusy(null);
    setConfirming(false);
    if (!reply) {
      toast.error(t("removeFailed"));
      return;
    }
    apply(reply);
    setRemoved(scriptId);
    toast.success(t("removed", { appName }));
    // The buttons went with it: the note says what's left to do in Google.
    focusAfter.current = "removedNote";
  }

  // Back from Google's consent screen: add or update it now, once. The address loses
  // its question, so reloading doesn't do it again.
  useEffect(() => {
    if (started.current || !returned.action) return;
    started.current = true;
    window.history.replaceState(null, "", CALENDAR_SETTINGS_ROUTE);
    // What it shows meanwhile (busy) started from `returned`.
    if (!returned.error) void send(returned.action);
  });

  // The add-on connects itself when it's first used, in Google: look on arrival (the
  // page may come from the browser's history), unless it's adding or updating it now,
  // and whenever the window comes back to the front.
  const sending = Boolean(returned.action && !returned.error);
  useEffect(() => {
    async function look() {
      const before = changes.current;
      const reply = await addonRequest("GET");
      if (reply && changes.current === before) setAddon(reply.addon);
    }
    if (!sending) void look();
    window.addEventListener("focus", look);
    return () => window.removeEventListener("focus", look);
  }, [sending]);

  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    (target === "openScript" ? openScript : removedNote).current?.focus();
  });

  if (addon.status === "unavailable") return null;

  const removeButton = (
    <Button
      variant="outline"
      className={OUTLINE}
      onPress={() => setConfirming(true)}
      aria-label={t("removeLabel", { appName })}
    >
      {t("remove")}
    </Button>
  );
  const scriptLink = (scriptId: string, ref?: typeof openScript) => (
    <LinkButton
      ref={ref}
      href={scriptEditorUrl(scriptId)}
      target="_blank"
      rel="noreferrer"
      className="h-[38px] rounded-[10px]"
    >
      <ExternalLink aria-hidden="true" />
      {t("openScript")}
      <NewTabNote />
    </LinkButton>
  );

  return (
    <SettingsCard title={t("title", { appName })} id="addon">
      {problem ? (
        <ProblemNote
          problem={problem}
          email={email}
          connectAnyway={() =>
            connectInPage({
              back: `${CALENDAR_SETTINGS_ROUTE}?addon=${lastAction}`,
              scope: GOOGLE_SCRIPT_SCOPE,
              anyAccount: true,
            })
          }
          retry={
            RETRY.has(problem.kind)
              ? () => {
                  if (lastAction === "add") add();
                  else void allow("update");
                }
              : null
          }
        />
      ) : null}
      {removed ? (
        <div ref={removedNote} tabIndex={-1} className="outline-none">
          <FormNotice icon={Info} role="status">
            {t("removedNotice")}{" "}
            <a
              href={scriptEditorUrl(removed)}
              target="_blank"
              rel="noreferrer"
              className="focus-ring rounded-sm font-semibold underline underline-offset-2"
            >
              {t("openScript")}
              <NewTabNote />
            </a>
          </FormNotice>
        </div>
      ) : null}
      {addon.status === "none" ? (
        <ConnectionState
          icon={<CalendarPlus className="size-[22px]" aria-hidden="true" />}
          tone="primary"
          title={t("addTitle", { appName })}
          actions={
            <Button
              className="h-[38px] rounded-[10px]"
              isPending={busy === "add"}
              onPress={add}
            >
              {t("add", { appName })}
            </Button>
          }
        >
          <p>{t("addBody", { appName })}</p>
          <p>{t("addHelp", { appName })}</p>
          {busy === "add" ? (
            <p role="status" className="text-foreground font-medium">
              {t("adding", { appName })}
            </p>
          ) : null}
        </ConnectionState>
      ) : null}
      {addon.status === "created" ? (
        <ConnectionState
          icon={<CalendarPlus className="size-[22px]" aria-hidden="true" />}
          tone="primary"
          title={t("createdTitle")}
          actions={
            <>
              {scriptLink(addon.scriptId, openScript)}
              {removeButton}
            </>
          }
        >
          <p>{t("createdIntro", { appName })}</p>
          <ol className="text-foreground flex list-decimal flex-col gap-1.5 pl-5">
            <li>{t("stepOpen")}</li>
            <li>{t("stepInstall")}</li>
            <li>{t("stepUse", { appName })}</li>
          </ol>
          <p>{t("whyInstall")}</p>
        </ConnectionState>
      ) : null}
      {addon.status === "connected" && !addon.needsUpdate ? (
        <ConnectionState
          icon={<CalendarCheck className="size-[22px]" aria-hidden="true" />}
          tone="primary"
          title={t("connectedTitle", { appName })}
          actions={
            <>
              <LinkButton
                href={GOOGLE_CALENDAR_URL}
                target="_blank"
                rel="noreferrer"
                variant="outline"
                className={OUTLINE}
              >
                <ExternalLink aria-hidden="true" />
                {t("openCalendar")}
                <NewTabNote />
              </LinkButton>
              {removeButton}
            </>
          }
        >
          <p>{t("connectedBody", { appName })}</p>
        </ConnectionState>
      ) : null}
      {addon.status === "connected" && addon.needsUpdate ? (
        <ConnectionState
          icon={<TriangleAlert className="size-[22px]" aria-hidden="true" />}
          tone="warning"
          title={t("updateTitle")}
          actions={
            <>
              <Button
                className="h-[38px] rounded-[10px]"
                isPending={busy === "update"}
                onPress={() => void allow("update")}
              >
                {t("update")}
              </Button>
              {removeButton}
            </>
          }
        >
          <p>{t("updateBody", { appName })}</p>
        </ConnectionState>
      ) : null}
      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title={t("removeTitle", { appName })}
        description={t("removeBody", { appName })}
        confirmLabel={t("remove")}
        cancelLabel={t("cancel")}
        isPending={busy === "remove"}
        onConfirm={() => void remove()}
      />
    </SettingsCard>
  );
}

/** What went wrong, with what to do about it. */
function ProblemNote({
  problem,
  email,
  connectAnyway,
  retry,
}: {
  problem: Problem;
  email: string;
  /** Back to Google, to connect a Google account with another email. */
  connectAnyway: () => Promise<boolean>;
  retry: (() => void) | null;
}) {
  const t = useTranslations("AddonSetup");
  const tc = useTranslations("GoogleCalendar");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const text =
    problem.kind === "emailMismatch" || problem.kind === "alreadyLinked"
      ? tc(`problems.${problem.kind}`, { email, appName })
      : t(`problems.${problem.kind}`, { appName });
  return (
    <div className="flex flex-col gap-2.5">
      <FormNotice icon={Info} tone="warning">
        {text}
      </FormNotice>
      <div className="flex flex-wrap gap-2">
        {problem.kind === "userApiOff" ? (
          <LinkButton
            href={APPS_SCRIPT_SETTINGS_URL}
            target="_blank"
            rel="noreferrer"
            variant="outline"
            className={OUTLINE}
          >
            <ExternalLink aria-hidden="true" />
            {t("openUserSettings")}
            <NewTabNote />
          </LinkButton>
        ) : null}
        {problem.kind === "serviceDisabled" && problem.consoleUrl ? (
          <LinkButton
            href={problem.consoleUrl}
            target="_blank"
            rel="noreferrer"
            variant="outline"
            className={OUTLINE}
          >
            <ExternalLink aria-hidden="true" />
            {t("turnOnApi")}
            <NewTabNote />
          </LinkButton>
        ) : null}
        {problem.kind === "emailMismatch" ? (
          <ConnectAnyway
            email={email}
            className={OUTLINE}
            connect={connectAnyway}
          />
        ) : null}
        {problem.kind === "alreadyLinked" ? (
          <SignInWithThatAccount className={OUTLINE} />
        ) : null}
        {retry ? (
          <Button variant="outline" className={OUTLINE} onPress={retry}>
            {t("tryAgain")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
