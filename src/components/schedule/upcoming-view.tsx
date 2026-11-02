"use client";

import { CalendarDays, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Segment, Segments } from "@/components/ui/segments";

import { UpcomingCalendar } from "./upcoming-calendar";
import { UpcomingList, type UpcomingRow } from "./upcoming-list";

const VIEWS = ["list", "calendar"] as const;
type View = (typeof VIEWS)[number];
const STORAGE_KEY = "faceon.upcoming.view";

function rememberedView(): View {
  try {
    return localStorage.getItem(STORAGE_KEY) === "calendar"
      ? "calendar"
      : "list";
  } catch {
    return "list";
  }
}

/** Upcoming as a list or a calendar; the choice is remembered on this device. */
export function UpcomingView({ rows }: { rows: UpcomingRow[] }) {
  const t = useTranslations("Upcoming");
  const [view, setView] = useState<View>(rememberedView);

  function choose(next: View) {
    setView(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered; that's fine.
    }
  }

  return (
    <div className="flex flex-col gap-6.5">
      <Segments
        label={t("view")}
        value={view}
        values={VIEWS}
        onChange={choose}
        className="-mt-2 self-start"
      >
        <Segment value="list">
          <List className="size-4" aria-hidden="true" />
          {t("list")}
        </Segment>
        <Segment value="calendar">
          <CalendarDays className="size-4" aria-hidden="true" />
          {t("calendar")}
        </Segment>
      </Segments>
      {view === "list" ? <UpcomingList rows={rows} /> : <UpcomingCalendar />}
    </div>
  );
}
