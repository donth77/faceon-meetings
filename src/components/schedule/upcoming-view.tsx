"use client";

import { CalendarDays, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Radio, RadioGroup } from "react-aria-components";

import { SEGMENT, SEGMENTS, UpcomingCalendar } from "./upcoming-calendar";
import { UpcomingList, type UpcomingRow } from "./upcoming-list";

type View = "list" | "calendar";
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
      <RadioGroup
        aria-label={t("view")}
        orientation="horizontal"
        value={view}
        onChange={(value) => choose(value as View)}
        className={`${SEGMENTS} -mt-2 self-start`}
      >
        <Radio value="list" className={SEGMENT}>
          <List className="size-4" aria-hidden="true" />
          {t("list")}
        </Radio>
        <Radio value="calendar" className={SEGMENT}>
          <CalendarDays className="size-4" aria-hidden="true" />
          {t("calendar")}
        </Radio>
      </RadioGroup>
      {view === "list" ? <UpcomingList rows={rows} /> : <UpcomingCalendar />}
    </div>
  );
}
