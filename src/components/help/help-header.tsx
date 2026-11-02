"use client";

import { ExternalLink, Search, Sparkles, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Button as AriaButton,
  ComboBox,
  Group,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components";

import { Button } from "@/components/ui/button";
import { NewTabNote } from "@/components/ui/new-tab-note";
import {
  ABOUT_MODEL,
  modelApi,
  modelLanguage,
  modelState,
  optionsFor,
  type ModelState,
} from "@/lib/ai/built-in";
import { publicEnv } from "@/lib/env";
import {
  ask,
  calloutDismissed,
  dismissCallout,
  relevant,
  type Doc,
} from "@/lib/help/assistant";
import type { HelpEntry } from "@/lib/help/sections";

/** How well an article matches: in its title first, then its summary, then its text. */
const scoreOf = (query: string, entry: HelpEntry) =>
  (entry.title.toLocaleLowerCase().includes(query) ? 4 : 0) +
  (entry.summary.toLocaleLowerCase().includes(query) ? 2 : 0) +
  (entry.text.toLocaleLowerCase().includes(query) ? 1 : 0);

/** Search every article from any Help page: matches open under the box, and Enter goes there. */
function HelpSearch({ entries }: { entries: HelpEntry[] }) {
  const t = useTranslations("Help");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase();
  const results = q
    ? entries
        .map((entry) => ({ entry, score: scoreOf(q, entry) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(({ entry }) => entry)
    : [];

  return (
    <ComboBox
      items={results}
      inputValue={query}
      onInputChange={setQuery}
      onSelectionChange={(key) => {
        if (key === null) return;
        setQuery("");
        router.push(`/help/${String(key)}`);
      }}
      menuTrigger="input"
      allowsEmptyCollection
      className="flex flex-col gap-1.5"
    >
      <Label className="text-sm font-semibold">{t("searchLabel")}</Label>
      <Group className="bg-background focus-within:ring-ring relative flex h-12 items-center rounded-xl border outline-none focus-within:ring-2">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3.5 size-5"
          aria-hidden="true"
        />
        <Input
          placeholder={t("searchPlaceholder")}
          className="placeholder:text-muted-foreground size-full rounded-xl bg-transparent pr-3 pl-11 text-base outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </Group>
      <Popover
        offset={6}
        className="bg-popover text-popover-foreground ring-foreground/10 data-entering:animate-in data-entering:fade-in-0 w-(--trigger-width) overflow-hidden rounded-xl shadow-lg ring-1"
      >
        <ListBox
          className="max-h-96 overflow-y-auto p-1.5 outline-none"
          renderEmptyState={() => (
            <p className="text-muted-foreground px-3 py-2.5 text-sm">
              {t("noResults", { query: query.trim() })}
            </p>
          )}
        >
          {(entry: HelpEntry) => (
            <ListBoxItem
              id={entry.slug}
              textValue={entry.title}
              className="data-focused:bg-muted data-focus-visible:focus-ring-inset flex flex-col gap-0.5 rounded-lg px-3 py-2 outline-hidden"
            >
              <span className="text-[15px] font-semibold">{entry.title}</span>
              <span className="text-muted-foreground text-[13px] leading-snug">
                {entry.summary}
              </span>
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}

/** **bold** and `keys` within a line of an answer. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <kbd
          key={index}
          className="bg-muted rounded border px-1 font-sans text-[13px] font-semibold"
        >
          {part.slice(1, -1)}
        </kbd>
      );
    }
    return part;
  });
}

/** The model writes a little Markdown: paragraphs, lists, bold and keys. */
function Answer({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2 text-[15px] leading-relaxed">
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter((line) => line.trim());
        if (lines.length && lines.every((line) => /^\s*[-*•]\s/.test(line))) {
          return (
            <ul key={index} className="flex list-disc flex-col gap-1 pl-5">
              {lines.map((line, i) => (
                <li key={i}>{inline(line.replace(/^\s*[-*•]\s/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (lines.length && lines.every((line) => /^\s*\d+[.)]\s/.test(line))) {
          return (
            <ol key={index} className="flex list-decimal flex-col gap-1 pl-5">
              {lines.map((line, i) => (
                <li key={i}>{inline(line.replace(/^\s*\d+[.)]\s/, ""))}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={index}>
            {lines.map((line, i) => (
              <span key={i}>
                {i > 0 ? <br /> : null}
                {inline(line.replace(/^#+\s*/, ""))}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

type Turn = {
  id: number;
  question: string;
  answer: string;
  sources: Doc[];
  status: "thinking" | "answering" | "done" | "noMatch" | "failed";
};

/**
 * The box: a question, and the answer written under it as it arrives. A new question
 * replaces the last one: each is answered on its own, so an old answer left on screen
 * would suggest a conversation the model doesn't remember.
 */
function ChatBox({ docs, language }: { docs: Doc[]; language: string }) {
  const t = useTranslations("Help.assistant");
  const inputId = useId();
  const [question, setQuestion] = useState("");
  const [turn, setTurn] = useState<Turn | null>(null);
  const busy = turn?.status === "thinking" || turn?.status === "answering";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const asked = question.trim();
    const api = modelApi();
    if (!asked || busy || !api) return;
    const id = Date.now();
    const sources = relevant(docs, asked);
    const update = (patch: Partial<Turn>) =>
      setTurn((current) =>
        current?.id === id ? { ...current, ...patch } : current,
      );
    setQuestion("");
    setTurn({
      id,
      question: asked,
      answer: "",
      sources,
      status: sources.length ? "thinking" : "noMatch",
    });
    if (!sources.length) return;
    try {
      let text = "";
      for await (const piece of ask(api, language, asked, sources)) {
        text += piece;
        update({ answer: text, status: "answering" });
      }
      update(text.trim() ? { status: "done" } : { status: "failed" });
    } catch {
      update({ status: "failed" });
    }
  }

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="bg-card ring-border flex flex-col gap-3 rounded-2xl p-4 ring-1 sm:p-5"
    >
      {/* It names the region; a heading here would come before the page's h1. */}
      <p id={`${inputId}-title`} className="flex items-center gap-2 font-bold">
        <Sparkles className="text-primary size-[18px]" aria-hidden="true" />
        {t("heading")}
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t("label")}
        </label>
        <input
          id={inputId}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          autoComplete="off"
          placeholder={t("placeholder", {
            appName: publicEnv.NEXT_PUBLIC_APP_NAME,
          })}
          className="bg-background placeholder:text-muted-foreground border-input focus-visible:focus-ring h-11 min-w-0 flex-1 rounded-[10px] border px-3 text-[15px] outline-hidden"
        />
        <Button
          type="submit"
          isDisabled={busy}
          className="h-11 rounded-[10px] px-4"
        >
          {t("send")}
        </Button>
      </form>
      {/* Read out once per answer, when it's complete, not chunk by chunk. */}
      <p role="status" className="sr-only">
        {turn?.status === "thinking"
          ? t("thinking")
          : turn?.status === "noMatch"
            ? t("noMatch")
            : turn?.status === "failed" && !turn.answer
              ? t("failed")
              : turn?.status === "done"
                ? turn.answer
                : ""}
      </p>
      {turn ? (
        <div
          aria-busy={turn.status === "answering"}
          className="flex flex-col gap-2 pt-1"
        >
          <p className="text-muted-foreground text-sm font-semibold">
            {turn.question}
          </p>
          {turn.status === "thinking" ? (
            <p className="text-muted-foreground text-[15px]">{t("thinking")}</p>
          ) : turn.status === "noMatch" ? (
            <p className="text-[15px]">{t("noMatch")}</p>
          ) : turn.status === "failed" && !turn.answer ? (
            <p className="text-destructive-text text-[15px]">{t("failed")}</p>
          ) : (
            <Answer text={turn.answer} />
          )}
          {turn.status === "done" ? (
            <>
              <p className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-1 text-[13px]">
                <span>{t("sources")}</span>
                {turn.sources.map((source) => (
                  <Link
                    key={source.slug}
                    href={`/help/${source.slug}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {source.title}
                  </Link>
                ))}
              </p>
              <p className="text-muted-foreground text-xs">{t("note")}</p>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Where the model can be had: what it is, and a button that downloads it right here. */
function Callout({
  kind,
  language,
  onReady,
  onDismiss,
}: {
  kind: Exclude<ModelState, "ready" | "none">;
  language: string;
  onReady: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("Help.assistant");
  const titleId = useId();
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const api = modelApi();

  function download() {
    if (!api) return;
    setFailed(false);
    setProgress(0);
    // Asking for a session from a click is what starts Chrome's download.
    api
      .create({
        ...optionsFor(language),
        monitor: (monitor) =>
          monitor.addEventListener("downloadprogress", (event) =>
            setProgress(
              Math.round(
                ((event as Event & { loaded?: number }).loaded ?? 0) * 100,
              ),
            ),
          ),
      })
      .then(
        (session) => {
          session.destroy();
          onReady();
        },
        () => {
          setProgress(null);
          setFailed(true);
        },
      );
  }

  return (
    <aside
      aria-labelledby={titleId}
      className="bg-secondary/50 relative flex flex-col gap-2.5 rounded-2xl p-4 pr-12 ring-1 ring-[#dbe4ff] sm:p-5 sm:pr-12 dark:ring-white/10"
    >
      <AriaButton
        aria-label={t("dismiss")}
        onPress={onDismiss}
        className="text-muted-foreground hover:bg-muted data-focus-visible:focus-ring absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-lg outline-hidden"
      >
        <X className="size-4" aria-hidden="true" />
      </AriaButton>
      <p id={titleId} className="flex items-center gap-2 font-bold">
        <Sparkles className="text-primary size-[18px]" aria-hidden="true" />
        {t("installHeading", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
      </p>
      <p className="text-[15px] leading-relaxed">
        {kind === "download"
          ? t("install")
          : kind === "enable"
            ? t("unavailable")
            : t("update")}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {kind === "download" && api ? (
          <Button
            onPress={download}
            isDisabled={progress !== null}
            className="h-10 rounded-[10px] px-4"
          >
            {t("download")}
          </Button>
        ) : null}
        <a
          href={ABOUT_MODEL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex items-center gap-1 text-sm font-semibold hover:underline"
        >
          {t("learnMore")}
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <NewTabNote />
        </a>
      </div>
      {/* Kept in the page when empty (not display:none), so updates are announced. */}
      <p role="status" className="text-muted-foreground text-sm empty:sr-only">
        {progress !== null
          ? t("downloading", { percent: progress })
          : failed
            ? t("failed")
            : null}
      </p>
    </aside>
  );
}

/**
 * Chrome's own model answering questions from Help, on this device: the box where the
 * model is ready, a callout to download it where it can be had, nothing elsewhere.
 */
function HelpAssistant({ entries }: { entries: HelpEntry[] }) {
  const locale = useLocale();
  const language = modelLanguage(locale);
  const [state, setState] = useState<ModelState | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const docs = useMemo<Doc[]>(
    () =>
      entries.map((entry) => ({
        slug: entry.slug,
        title: entry.title,
        keywords: entry.summary,
        text: entry.text,
      })),
    [entries],
  );

  useEffect(() => {
    if (!language) return;
    let cancelled = false;
    void modelState(modelApi(), language).then((found) => {
      if (cancelled) return;
      setDismissed(calloutDismissed());
      setState(found);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  if (!language || state === null || state === "none") return null;
  if (state === "ready") return <ChatBox docs={docs} language={language} />;
  if (dismissed) return null;
  return (
    <Callout
      kind={state}
      language={language}
      onReady={() => setState("ready")}
      onDismiss={() => {
        dismissCallout();
        setDismissed(true);
      }}
    />
  );
}

/** At the top of every Help page: search, and asking Chrome's built-in AI. */
export function HelpHeader({ entries }: { entries: HelpEntry[] }) {
  return (
    <div className="flex flex-col gap-4">
      <HelpSearch entries={entries} />
      <HelpAssistant entries={entries} />
    </div>
  );
}
