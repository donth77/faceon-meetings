"use client";

import { Square } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { MeetingNotes } from "@/lib/notes/notes";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[15px] font-bold">{title}</h3>
      {children}
    </section>
  );
}

/**
 * AI notes, as in the mockup: Summary, Action items (with who and by when) and
 * Decisions. Everything is plain text; nothing the model wrote becomes HTML.
 */
export function NotesView({ notes }: { notes: MeetingNotes }) {
  const t = useTranslations("Notes");
  const none = <p className="text-muted-foreground text-sm">{t("none")}</p>;
  return (
    <div className="flex flex-col gap-5">
      <Section title={t("summary")}>
        {notes.summary ? (
          <p className="max-w-[68ch] text-[15px] leading-relaxed whitespace-pre-line">
            {notes.summary}
          </p>
        ) : (
          none
        )}
      </Section>
      <Section title={t("actionItems")}>
        {notes.actionItems.length > 0 ? (
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
        )}
      </Section>
      <Section title={t("decisions")}>
        {notes.decisions.length > 0 ? (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-snug">
            {notes.decisions.map((decision, index) => (
              <li key={index}>{decision}</li>
            ))}
          </ul>
        ) : (
          none
        )}
      </Section>
    </div>
  );
}
