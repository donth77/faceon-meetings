"use client";

import { cn } from "cn";
import { Square } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { MeetingNotes } from "@/lib/notes/notes";

/** A card on the notes page, as in the mockup. */
export const NOTES_CARD =
  "bg-card flex flex-col gap-3 rounded-2xl px-6 py-5.5 ring-1 ring-[#e2e5ea] dark:ring-white/10";

/**
 * AI notes, as in the mockup: Summary, Action items (with who and by when) and
 * Decisions. Everything is plain text; nothing the model wrote becomes HTML. Stacked in
 * a panel; as cards on the notes page.
 */
export function NotesView({
  notes,
  layout = "stack",
}: {
  notes: MeetingNotes;
  layout?: "stack" | "cards";
}) {
  const t = useTranslations("Notes");
  const cards = layout === "cards";
  // In a panel the sections sit under its title; on the page, under the page's.
  const Heading = cards ? "h2" : "h3";
  const none = <p className="text-muted-foreground text-sm">{t("none")}</p>;
  const section = (title: string, children: ReactNode, wide = false) => (
    <section
      className={cn(
        cards ? NOTES_CARD : "flex flex-col gap-2",
        cards && wide && "col-span-full",
      )}
    >
      <Heading
        className={cards ? "text-lg font-bold" : "text-[15px] font-bold"}
      >
        {title}
      </Heading>
      {children}
    </section>
  );

  return (
    <div
      className={cards ? "grid gap-4 sm:grid-cols-2" : "flex flex-col gap-5"}
    >
      {section(
        t("summary"),
        notes.summary ? (
          <p
            className={cn(
              "max-w-[68ch] leading-relaxed whitespace-pre-line",
              cards ? "text-base" : "text-[15px]",
            )}
          >
            {notes.summary}
          </p>
        ) : (
          none
        ),
        true,
      )}
      {section(
        t("actionItems"),
        notes.actionItems.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {notes.actionItems.map((item, index) => (
              <li
                key={index}
                className="flex items-start gap-2.5 text-[15px] leading-snug"
              >
                <Square
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  {item.task}
                  <span className="text-muted-foreground text-[13px]">
                    {[
                      item.owner ?? t("noOwner"),
                      item.due ? t("dueBy", { when: item.due }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          none
        ),
      )}
      {section(
        t("decisions"),
        notes.decisions.length > 0 ? (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-snug">
            {notes.decisions.map((decision, index) => (
              <li key={index}>{decision}</li>
            ))}
          </ul>
        ) : (
          none
        ),
      )}
    </div>
  );
}
