"use client";

import { cn } from "cn";
import { Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Radio, RadioGroup, ToggleButton } from "react-aria-components";

import { Button as UIButton } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  INPUT,
  RadioDot,
  SelectField,
  type Option,
} from "@/components/ui/form-fields";
import { describeRecurrence, presetLabel } from "@/lib/meetings/describe";
import {
  latestSeriesEnd,
  presetOf,
  presetRecurrence,
  REPEAT_PRESETS,
  startFacts,
  type Recurrence,
} from "@/lib/meetings/recurrence";
import { oneOf } from "@/lib/narrow";
import { useIntlLocale } from "@/lib/preferences";
import { weekdayName, weekdaysInOrder } from "@/lib/weekdays";

import { DateField } from "./date-field";

const NUMBER = cn(INPUT, "h-10 w-16 px-2.5 text-[15px]");
const RADIO =
  "group flex min-h-10 cursor-default items-center gap-3 text-[15px] outline-hidden";
const FREQS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
const MONTHLY = ["date", "weekday", "lastWeekday"] as const;

/** The Custom recurrence dialog: every n units, on which days, and when it ends. */
function CustomDialog({
  startDate,
  initial,
  onDone,
  onClose,
}: {
  startDate: string;
  initial: Recurrence;
  onDone: (recurrence: Recurrence) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Schedule");
  const tr = useTranslations("Recurrence");
  const locale = useIntlLocale();
  const facts = startFacts(startDate);
  const [draft, setDraft] = useState<Recurrence>(initial);
  const everyId = useId();
  const onId = useId();
  const endsId = useId();
  const untilId = useId();
  const update = (patch: Partial<Recurrence>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const days = draft.byDay?.length ? draft.byDay : [facts.weekday];
  const untilDate =
    draft.end.kind === "on" ? draft.end.date : addMonths(startDate, 3);
  const count = draft.end.kind === "after" ? draft.end.count : 13;

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      closeLabel={t("cancel")}
      className="sm:max-w-[440px]"
    >
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">
          {t("customTitle")}
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor={everyId} className="text-[15px]">
            {t("repeatEvery")}
          </label>
          <input
            id={everyId}
            type="number"
            min={1}
            max={99}
            value={draft.interval}
            onChange={(event) =>
              update({
                interval: Math.min(
                  99,
                  Math.max(1, Number(event.target.value) || 1),
                ),
              })
            }
            className={NUMBER}
          />
          <SelectField
            label={t("repeatUnit")}
            hideLabel
            options={FREQS.map((freq) => ({
              id: freq,
              label: t(`unit${freq}`, { count: draft.interval }),
            }))}
            value={draft.freq}
            onChange={(value) => {
              const freq = oneOf(FREQS, value);
              if (!freq) return;
              update({
                freq,
                byDay: freq === "WEEKLY" ? days : undefined,
                monthly: freq === "MONTHLY" ? "date" : undefined,
              });
            }}
            buttonClassName="h-10 w-36 text-[15px]"
          />
        </div>

        {draft.freq === "WEEKLY" ? (
          <div className="flex flex-col gap-2.5">
            <span id={onId} className="text-[15px]">
              {t("repeatOn")}
            </span>
            <div
              role="group"
              aria-labelledby={onId}
              className="flex flex-wrap gap-1.5"
            >
              {weekdaysInOrder(locale).map((day) => (
                <ToggleButton
                  key={day}
                  aria-label={weekdayName(day, locale, "long")}
                  isSelected={days.includes(day)}
                  onChange={(on) => {
                    const next = on
                      ? [...days, day]
                      : days.filter((d) => d !== day);
                    if (next.length > 0) update({ byDay: next });
                  }}
                  className="bg-muted data-focus-visible:focus-ring data-selected:bg-primary data-selected:text-primary-foreground flex size-10 items-center justify-center rounded-full text-sm font-bold outline-hidden dark:bg-white/10"
                >
                  {weekdayName(day, locale, "narrow")}
                </ToggleButton>
              ))}
            </div>
          </div>
        ) : null}

        {draft.freq === "MONTHLY" ? (
          <RadioGroup
            aria-label={t("repeatOn")}
            value={draft.monthly ?? "date"}
            onChange={(value) => update({ monthly: oneOf(MONTHLY, value) })}
            className="flex flex-col gap-0.5"
          >
            <Radio value="date" className={RADIO}>
              <RadioDot />
              {t("monthlyOnDay", { day: facts.day })}
            </Radio>
            <Radio value="weekday" className={RADIO}>
              <RadioDot />
              {tr("monthlyOn", {
                nth: facts.nth === 5 ? 0 : facts.nth,
                weekday: weekdayName(facts.weekday, locale, "long"),
              })}
            </Radio>
            {facts.isLast && facts.nth !== 5 ? (
              <Radio value="lastWeekday" className={RADIO}>
                <RadioDot />
                {tr("monthlyOn", {
                  nth: 0,
                  weekday: weekdayName(facts.weekday, locale, "long"),
                })}
              </Radio>
            ) : null}
          </RadioGroup>
        ) : null}

        <RadioGroup
          aria-labelledby={endsId}
          value={draft.end.kind}
          onChange={(kind) =>
            update({
              end:
                kind === "on"
                  ? { kind: "on", date: untilDate }
                  : kind === "after"
                    ? { kind: "after", count }
                    : { kind: "never" },
            })
          }
          className="flex flex-col gap-1"
        >
          <span id={endsId} className="mb-1.5 text-[15px]">
            {t("ends")}
          </span>
          <Radio value="never" className={RADIO}>
            <RadioDot />
            {t("never")}
          </Radio>
          <div className="flex items-center gap-3">
            <Radio value="on" className={RADIO}>
              <RadioDot />
              <span id={untilId}>{t("endsOn")}</span>
            </Radio>
            <div className="ml-auto w-44">
              <DateField
                labelId={untilId}
                value={untilDate}
                minValue={startDate}
                maxValue={latestSeriesEnd(startDate)}
                onChange={(date) => update({ end: { kind: "on", date } })}
                previousLabel={t("previousMonth")}
                nextLabel={t("nextMonth")}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Radio value="after" className={RADIO}>
              <RadioDot />
              {t("endsAfter")}
            </Radio>
            <span className="ml-auto flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={730}
                aria-label={t("occurrencesLabel")}
                value={count}
                onChange={(event) =>
                  update({
                    end: {
                      kind: "after",
                      count: Math.min(
                        730,
                        Math.max(1, Number(event.target.value) || 1),
                      ),
                    },
                  })
                }
                className={NUMBER}
              />
              <span className="text-muted-foreground">
                {t("occurrences", { count })}
              </span>
            </span>
          </div>
        </RadioGroup>

        <p className="bg-muted text-muted-foreground rounded-[10px] px-3 py-2.5 text-sm">
          {describeRecurrence(
            tr,
            { ...draft, byDay: draft.freq === "WEEKLY" ? days : undefined },
            startDate,
            locale,
          )}
        </p>
      </div>
      <DialogFooter>
        <UIButton variant="ghost" onPress={onClose}>
          {t("cancel")}
        </UIButton>
        <UIButton
          onPress={() =>
            onDone({
              ...draft,
              byDay: draft.freq === "WEEKLY" ? days : undefined,
            })
          }
        >
          {t("done")}
        </UIButton>
      </DialogFooter>
    </Dialog>
  );
}

function addMonths(date: string, months: number): string {
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1 + months, d));
  return next.toISOString().slice(0, 10);
}

/** Repeat: Google Calendar's choices for the chosen day, and Custom…. */
export function RepeatField({
  startDate,
  value,
  onChange,
}: {
  /** The meeting's local start date, "YYYY-MM-DD". */
  startDate: string;
  value: Recurrence | null;
  onChange: (value: Recurrence | null) => void;
}) {
  const t = useTranslations("Schedule");
  const tr = useTranslations("Recurrence");
  const locale = useIntlLocale();
  const facts = startFacts(startDate);
  const current = presetOf(value, facts);
  const [customOpen, setCustomOpen] = useState(false);

  const items: Option[] = REPEAT_PRESETS.map((preset) => ({
    id: preset,
    label: presetLabel(tr, preset, facts, locale),
  }));
  if (current === "custom" && value) {
    items.push({
      id: "current",
      label: describeRecurrence(tr, value, startDate, locale),
    });
  }
  items.push({ id: "custom", label: tr("custom"), separated: true });

  return (
    <>
      <SelectField
        label={t("repeat")}
        icon={Repeat}
        options={items}
        value={current === "custom" ? "current" : current}
        onChange={(value) => {
          if (value === "custom") setCustomOpen(true);
          const preset = oneOf(REPEAT_PRESETS, value);
          if (preset) onChange(presetRecurrence(preset, facts));
        }}
        buttonClassName="sm:w-auto sm:min-w-[280px] sm:self-start"
        popoverClassName="w-[340px] max-w-[calc(100vw-2rem)]"
      />
      {customOpen ? (
        <CustomDialog
          startDate={startDate}
          initial={
            value ?? {
              freq: "WEEKLY",
              interval: 1,
              byDay: [facts.weekday],
              end: { kind: "never" },
            }
          }
          onDone={(recurrence) => {
            onChange(recurrence);
            setCustomOpen(false);
          }}
          onClose={() => setCustomOpen(false)}
        />
      ) : null}
    </>
  );
}
