"use client";

import {
  ChevronDown,
  ExternalLink,
  Keyboard,
  Link2,
  Mic,
  MonitorUp,
  Search,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  Button as AriaButton,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  Heading,
} from "react-aria-components";

import { GitHubIcon } from "@/components/auth/provider-icons";
import { useOpenShortcuts } from "@/components/shortcuts/shortcuts-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { publicEnv } from "@/lib/env";

/** Getting-started guides, for features that exist today. */
const GUIDES: Array<{ id: GuideId; icon: LucideIcon }> = [
  { id: "start", icon: Video },
  { id: "join", icon: Link2 },
  { id: "muteCamera", icon: Mic },
  { id: "share", icon: MonitorUp },
];
type GuideId = "start" | "join" | "muteCamera" | "share";

const QUESTIONS = [
  "hearMe",
  "shareSound",
  "phoneShare",
  "cameraInUse",
  "free",
  "recorded",
] as const;

const matches = (query: string, ...texts: string[]) =>
  texts.some((text) => text.toLocaleLowerCase().includes(query));

function GuideDialog({
  guide,
  onClose,
}: {
  guide: GuideId;
  onClose: () => void;
}) {
  const t = useTranslations("Help");
  const steps = t(`guides.${guide}.steps`).split("\n");
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="sm:max-w-md"
      closeLabel={t("close")}
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          {t(`guides.${guide}.title`)}
        </DialogTitle>
        <DialogDescription>{t(`guides.${guide}.summary`)}</DialogDescription>
      </DialogHeader>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-normal">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </Dialog>
  );
}

/**
 * The Help page body: search, getting-started guides, common questions, keyboard
 * shortcuts, and where to report a problem.
 */
export function HelpCenter({ repoUrl }: { repoUrl?: string | undefined }) {
  const t = useTranslations("Help");
  const openShortcuts = useOpenShortcuts();
  const searchId = useId();
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const [query, setQuery] = useState("");
  const [openGuide, setOpenGuide] = useState<GuideId | null>(null);

  const q = query.trim().toLocaleLowerCase();
  const guides = GUIDES.filter(
    ({ id }) =>
      !q ||
      matches(
        q,
        t(`guides.${id}.title`),
        t(`guides.${id}.summary`),
        t(`guides.${id}.steps`),
      ),
  );
  const questions = QUESTIONS.filter(
    (id) =>
      !q ||
      matches(
        q,
        t(`faq.${id}.question`, { appName }),
        t(`faq.${id}.answer`, { appName }),
      ),
  );

  return (
    <main className="flex w-full max-w-[860px] flex-1 flex-col gap-10 px-5 py-8 sm:px-10 sm:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle", { appName })}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={searchId} className="text-sm font-semibold">
          {t("searchLabel")}
        </label>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-12 rounded-xl pl-11 text-base md:text-base"
          />
        </div>
      </div>

      {guides.length > 0 ? (
        <section aria-labelledby="help-guides" className="flex flex-col gap-3">
          <h2 id="help-guides" className="text-xl font-bold">
            {t("gettingStarted")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {guides.map(({ id, icon: Icon }) => (
              <AriaButton
                key={id}
                onPress={() => setOpenGuide(id)}
                className="bg-card ring-border hover:ring-primary/40 focus-visible:ring-ring flex items-start gap-3 rounded-2xl p-4 text-left ring-1 outline-none focus-visible:ring-2"
              >
                <span className="bg-secondary text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-semibold">
                    {t(`guides.${id}.title`)}
                  </span>
                  <span className="text-muted-foreground text-sm leading-normal">
                    {t(`guides.${id}.summary`)}
                  </span>
                </span>
              </AriaButton>
            ))}
          </div>
        </section>
      ) : null}

      {questions.length > 0 ? (
        <section aria-labelledby="help-faq" className="flex flex-col gap-3">
          <h2 id="help-faq" className="text-xl font-bold">
            {t("faqTitle")}
          </h2>
          <DisclosureGroup className="bg-card ring-border divide-y rounded-2xl ring-1">
            {questions.map((id) => (
              <Disclosure key={id} id={id} className="group">
                <Heading level={3}>
                  <AriaButton
                    slot="trigger"
                    className="focus-visible:ring-ring flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left font-semibold outline-none focus-visible:ring-2 focus-visible:ring-inset"
                  >
                    {t(`faq.${id}.question`, { appName })}
                    <ChevronDown
                      className="text-muted-foreground size-5 shrink-0 transition-transform group-data-[expanded]:rotate-180 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </AriaButton>
                </Heading>
                <DisclosurePanel>
                  <p className="text-muted-foreground px-5 pb-4 text-[15px] leading-relaxed">
                    {t(`faq.${id}.answer`, { appName })}
                  </p>
                </DisclosurePanel>
              </Disclosure>
            ))}
          </DisclosureGroup>
        </section>
      ) : null}

      {q && guides.length === 0 && questions.length === 0 ? (
        <p role="status" className="text-muted-foreground">
          {t("noResults", { query: query.trim() })}
        </p>
      ) : null}

      <section
        id="keyboard-shortcuts"
        aria-labelledby="help-shortcuts"
        className="bg-card ring-border flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 ring-1"
      >
        <div className="flex items-start gap-3">
          <span className="bg-secondary text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Keyboard className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="help-shortcuts" className="font-semibold">
              {t("shortcutsTitle")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t.rich("shortcutsBody", {
                key: (chunks) => (
                  <kbd className="bg-muted rounded border px-1.5 font-sans text-xs font-semibold">
                    {chunks}
                  </kbd>
                ),
              })}
            </p>
          </div>
        </div>
        <Button variant="outline" size="lg" onPress={openShortcuts}>
          <Keyboard aria-hidden="true" />
          {t("showShortcuts")}
        </Button>
      </section>

      {repoUrl ? (
        <div className="flex flex-col items-center gap-3">
          <a
            href={`${repoUrl.replace(/\/$/, "")}/issues/new/choose`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card ring-border hover:bg-muted focus-visible:ring-ring flex h-12 w-full items-center justify-center gap-2.5 rounded-xl font-semibold ring-1 outline-none focus-visible:ring-2"
          >
            <GitHubIcon className="size-5" />
            {t("reportIssue")}
            <ExternalLink className="size-4" aria-hidden="true" />
            <span className="sr-only">{t("opensInNewTab")}</span>
          </a>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <GitHubIcon className="size-4" />
            {t("viewSource")}
          </a>
        </div>
      ) : null}

      {openGuide ? (
        <GuideDialog guide={openGuide} onClose={() => setOpenGuide(null)} />
      ) : null}
    </main>
  );
}
