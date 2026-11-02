"use client";

import {
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Download,
  ExternalLink,
  LoaderCircle,
  Repeat,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Recurrence } from "@/lib/meetings/recurrence";
import type {
  ScheduleDraft,
  ScheduleInput,
  SeriesScope,
} from "@/lib/meetings/schedule";
import {
  scheduleMeetingAction,
  updateScheduleAction,
} from "@/lib/meetings/schedule-actions";
import { useIntlLocale } from "@/lib/preferences";
import { deviceTimeZone, zonedToUtc } from "@/lib/time";

import { DateField } from "./date-field";
import { Field, INPUT, SelectField, SwitchRow } from "./fields";
import { useScheduledInvitation, type ScheduledMeeting } from "./invitation";
import { InviteesField } from "./invitees-field";
import { RepeatField } from "./repeat-field";
import { ScopeDialog } from "./scope-dialog";
import { TimeZoneField } from "./time-zone-field";

export type ScheduleFormValues = {
  title: string;
  description: string;
  date: string;
  time: string;
  durationMin: number;
  timeZone: string;
  recurrence: Recurrence | null;
  invitees: string[];
  passcode: boolean;
  waitingRoom: boolean;
  allowGuests: boolean;
  joinBeforeHost: boolean;
  muteOnEntry: boolean;
};

const DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480];
const TIMES = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

/** The next half hour, in this device's time zone: a sensible start for a new meeting. */
function nextHalfHour(timeZone: string): { date: string; time: string } {
  const at = new Date(Math.ceil(Date.now() / 1_800_000) * 1_800_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function defaultValues(): ScheduleFormValues {
  const timeZone = deviceTimeZone();
  return {
    title: "",
    description: "",
    ...nextHalfHour(timeZone),
    durationMin: 60,
    timeZone,
    recurrence: null,
    invitees: [],
    passcode: true,
    waitingRoom: true,
    allowGuests: true,
    joinBeforeHost: false,
    muteOnEntry: false,
  };
}

function formatTime(time: string, locale: string) {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, h, m)));
}

function formatDuration(minutes: number, locale: string) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const unit = (value: number, kind: "hour" | "minute") =>
    new Intl.NumberFormat(locale, {
      style: "unit",
      unit: kind,
      unitDisplay: "long",
    }).format(value);
  if (hours === 0) return unit(rest, "minute");
  if (rest === 0) return unit(hours, "hour");
  return new Intl.ListFormat(locale, { style: "narrow", type: "unit" }).format([
    unit(hours, "hour"),
    unit(rest, "minute"),
  ]);
}

const toInput = (values: ScheduleFormValues): ScheduleInput => ({
  title: values.title,
  description: values.description,
  start: `${values.date}T${values.time}`,
  timeZone: values.timeZone,
  durationMin: values.durationMin,
  recurrence: values.recurrence,
  passcode: values.passcode,
  waitingRoom: values.waitingRoom,
  allowGuests: values.allowGuests,
  joinBeforeHost: values.joinBeforeHost && !values.waitingRoom,
  muteOnEntry: values.muteOnEntry,
  invitees: values.invitees,
});

function InvitationCard({
  meeting,
  saved,
}: {
  meeting: ScheduledMeeting;
  saved: boolean;
}) {
  const t = useTranslations("Schedule");
  const invitation = useScheduledInvitation(meeting);
  const unsaved = saved ? undefined : t("saveToShare");
  return (
    <section
      aria-label={t("invitation")}
      className="bg-card flex min-w-0 flex-[1_1_340px] flex-col gap-4 self-start rounded-2xl p-6 ring-1 ring-[#e2e5ea] dark:ring-white/10"
    >
      <h2 className="text-lg font-bold">{t("invitation")}</h2>
      <p className="bg-muted rounded-xl p-4 text-sm leading-relaxed break-words whitespace-pre-wrap">
        {invitation.text}
      </p>
      <Button
        onPress={() => void invitation.copyInvitation(unsaved)}
        className="h-11 rounded-[10px]"
      >
        <Copy aria-hidden="true" />
        {t("copyInvitation")}
      </Button>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
        <Button
          variant="outline"
          className="h-10 rounded-[10px]"
          onPress={() =>
            window.open(invitation.googleLink, "_blank", "noopener")
          }
        >
          {t("google")}
        </Button>
        <Button
          variant="outline"
          className="h-10 rounded-[10px]"
          onPress={() =>
            window.open(invitation.outlookLink, "_blank", "noopener")
          }
        >
          {t("outlook")}
        </Button>
        <Button
          variant="outline"
          className="h-10 rounded-[10px]"
          onPress={invitation.downloadIcs}
        >
          {t("icsFile")}
        </Button>
      </div>
    </section>
  );
}

/** "Meeting scheduled": the link, the invitation, and Add to calendar. */
function ScheduledDialog({
  meeting,
  onDone,
}: {
  meeting: ScheduledMeeting;
  onDone: () => void;
}) {
  const t = useTranslations("Schedule");
  const invitation = useScheduledInvitation(meeting);
  const linkId = useId();
  return (
    <Dialog
      isOpen
      isDismissable={false}
      showCloseButton={false}
      className="sm:max-w-[580px]"
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ddf5e8] text-[#13804b]">
            <Check className="size-[22px]" aria-hidden="true" />
          </span>
          {t("scheduledTitle")}
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-1">
        <span className="text-lg font-bold">{meeting.title}</span>
        <span className="text-muted-foreground text-[15px]">
          {t("starts", { when: invitation.when })}
        </span>
        {invitation.repeats ? (
          <span className="text-muted-foreground flex items-center gap-2 text-[15px]">
            <Repeat className="size-[18px]" aria-hidden="true" />
            {invitation.repeats}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={linkId} className="text-sm font-semibold">
          {t("meetingLink")}
        </label>
        <div className="flex gap-2">
          <input
            id={linkId}
            readOnly
            value={invitation.link}
            className="bg-muted h-11 min-w-0 flex-1 rounded-[10px] border border-[#c9cfd8] px-3 font-mono text-[13px] dark:border-white/15"
          />
          <Button
            variant="secondary"
            className="h-11 rounded-[10px]"
            onPress={() => void invitation.copyLink()}
          >
            <Copy aria-hidden="true" />
            {t("copyLink")}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="h-11 rounded-[10px]"
          onPress={() => void invitation.copyInvitation()}
        >
          <Copy aria-hidden="true" />
          {t("copyInvitation")}
        </Button>
        <DropdownMenuTrigger>
          <Button variant="outline" className="h-11 rounded-[10px]">
            <CalendarPlus aria-hidden="true" />
            {t("addToCalendar")}
            <ChevronDown aria-hidden="true" />
          </Button>
          <DropdownMenu className="min-w-64">
            <DropdownMenuItem
              onAction={() =>
                window.open(invitation.googleLink, "_blank", "noopener")
              }
            >
              <ExternalLink aria-hidden="true" />
              {t("google")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onAction={() =>
                window.open(invitation.outlookLink, "_blank", "noopener")
              }
            >
              <ExternalLink aria-hidden="true" />
              {t("outlook")}
            </DropdownMenuItem>
            <DropdownMenuItem onAction={invitation.downloadIcs}>
              <Download aria-hidden="true" />
              {t("appleIcs")}
            </DropdownMenuItem>
          </DropdownMenu>
        </DropdownMenuTrigger>
      </div>
      <DialogFooter className="mt-6">
        <Button
          className="h-[46px] rounded-xl px-6 text-base"
          onPress={onDone}
          autoFocus
        >
          {t("done")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/**
 * Schedule a meeting (or edit one): title, when and how it repeats, who's invited and
 * the security settings, with a live invitation beside the form.
 */
export function ScheduleForm({
  hostName,
  draft,
  initial,
  edit,
}: {
  hostName: string;
  /** New meetings: the ID and passcode the invitation previews. */
  draft?: ScheduleDraft;
  /** New meetings: values to start from (Schedule again). */
  initial?: Partial<ScheduleFormValues>;
  edit?: {
    code: string;
    passcode: string | null;
    values: ScheduleFormValues;
    /** The occurrence being edited (ISO), for a series. */
    occurrence: string | null;
    isSeries: boolean;
  };
}) {
  const t = useTranslations("Schedule");
  const locale = useIntlLocale();
  const router = useRouter();
  const ids = { title: useId(), date: useId(), description: useId() };
  const [values, setValues] = useState<ScheduleFormValues>(
    () => edit?.values ?? { ...defaultValues(), ...initial },
  );
  const [saving, setSaving] = useState(false);
  const [scoping, setScoping] = useState(false);
  const [scheduled, setScheduled] = useState<string | null>(null);
  const set = (patch: Partial<ScheduleFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const code = edit?.code ?? draft?.code ?? "";
  const passcode = values.passcode
    ? (edit?.passcode ?? draft?.passcode ?? null)
    : null;
  const start = zonedToUtc(`${values.date}T${values.time}`, values.timeZone);
  const meeting: ScheduledMeeting = {
    code,
    passcode,
    hostName,
    title: values.title.trim() || t("untitled"),
    start,
    end: new Date(start.getTime() + values.durationMin * 60_000),
    timeZone: values.timeZone,
    startDate: values.date,
    recurrence: values.recurrence,
    invitees: values.invitees,
  };

  async function save(scope: SeriesScope) {
    setSaving(true);
    try {
      const result = edit
        ? await updateScheduleAction(
            edit.code,
            toInput(values),
            scope,
            edit.occurrence,
          )
        : draft
          ? await scheduleMeetingAction(toInput(values), draft)
          : null;
      if (!result?.ok) {
        toast.error(
          t(result?.reason === "dailyLimit" ? "dailyLimit" : "saveFailed"),
        );
        return;
      }
      if (edit) {
        toast.success(t("saved"));
        router.push(`/meetings/${edit.code}`);
      } else {
        setScheduled(result.code);
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.title.trim()) return;
    if (edit?.isSeries && edit.occurrence) setScoping(true);
    else void save("all");
  }

  const timeOptions = TIMES.map((time) => ({
    id: time,
    label: formatTime(time, locale),
  }));
  const durationOptions = DURATIONS.map((minutes) => ({
    id: String(minutes),
    label: formatDuration(minutes, locale),
  }));

  return (
    <div className="flex w-full max-w-[1100px] flex-col gap-6">
      <Link
        href={edit ? `/meetings/${edit.code}` : "/upcoming"}
        className="text-primary flex items-center gap-1 self-start text-sm font-semibold"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {edit ? t("backToMeeting") : t("backToUpcoming")}
      </Link>
      <h1 className="text-[32px] font-bold tracking-[-0.01em]">
        {edit ? t("editTitle") : t("title")}
      </h1>
      <div className="flex flex-wrap items-start gap-6">
        <form
          onSubmit={handleSubmit}
          className="bg-card flex min-w-0 flex-[999_1_460px] flex-col gap-5 rounded-2xl p-6 ring-1 ring-[#e2e5ea] dark:ring-white/10"
        >
          <Field label={t("titleLabel")} htmlFor={ids.title}>
            <input
              id={ids.title}
              required
              maxLength={200}
              value={values.title}
              onChange={(event) => set({ title: event.target.value })}
              className={INPUT}
            />
          </Field>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
            <Field label={t("date")} labelId={ids.date}>
              <DateField
                labelId={ids.date}
                value={values.date}
                onChange={(date) => set({ date })}
                previousLabel={t("previousMonth")}
                nextLabel={t("nextMonth")}
              />
            </Field>
            <SelectField
              label={t("startTime")}
              options={timeOptions}
              value={values.time}
              onChange={(time) => set({ time })}
            />
            <SelectField
              label={t("duration")}
              options={durationOptions}
              value={String(values.durationMin)}
              onChange={(minutes) => set({ durationMin: Number(minutes) })}
            />
          </div>
          <RepeatField
            startDate={values.date}
            value={values.recurrence}
            onChange={(recurrence) => set({ recurrence })}
          />
          <TimeZoneField
            label={t("timeZone")}
            value={values.timeZone}
            onChange={(timeZone) => set({ timeZone })}
          />
          <Field
            label={t("description")}
            optional={t("optional")}
            htmlFor={ids.description}
          >
            <textarea
              id={ids.description}
              rows={3}
              maxLength={2000}
              value={values.description}
              onChange={(event) => set({ description: event.target.value })}
              className={`${INPUT} h-auto resize-y py-2.5`}
            />
          </Field>
          <InviteesField
            label={t("invitePeople")}
            optional={t("optional")}
            value={values.invitees}
            onChange={(invitees) => set({ invitees })}
          />
          <fieldset className="flex flex-col">
            <legend className="text-muted-foreground mb-1 text-[13px] font-bold tracking-[0.06em] uppercase">
              {t("security")}
            </legend>
            <SwitchRow
              label={t("requirePasscode")}
              help={
                values.passcode && passcode
                  ? t.rich("passcodeHelp", {
                      passcode: () => (
                        <span className="text-foreground font-mono">
                          {passcode}
                        </span>
                      ),
                    })
                  : undefined
              }
              isSelected={values.passcode}
              onChange={(on) => set({ passcode: on })}
            />
            <SwitchRow
              label={t("waitingRoom")}
              help={t("waitingRoomHelp")}
              isSelected={values.waitingRoom}
              onChange={(on) => set({ waitingRoom: on })}
            />
            <SwitchRow
              label={t("allowGuests")}
              help={t("allowGuestsHelp")}
              isSelected={values.allowGuests}
              onChange={(on) => set({ allowGuests: on })}
            />
          </fieldset>
          <fieldset className="flex flex-col">
            <legend className="text-muted-foreground mb-1 text-[13px] font-bold tracking-[0.06em] uppercase">
              {t("whenPeopleJoin")}
            </legend>
            <SwitchRow
              label={t("muteOnEntry")}
              isSelected={values.muteOnEntry}
              onChange={(on) => set({ muteOnEntry: on })}
            />
            <SwitchRow
              label={t("joinBeforeHost")}
              help={values.waitingRoom ? t("joinBeforeHostOff") : undefined}
              isSelected={values.joinBeforeHost && !values.waitingRoom}
              isDisabled={values.waitingRoom}
              onChange={(on) => set({ joinBeforeHost: on })}
            />
          </fieldset>
          <div className="flex gap-2">
            <Button
              type="submit"
              isPending={saving}
              className="h-[46px] rounded-xl px-6 text-base"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : null}
              {t("save")}
            </Button>
            <Button
              variant="outline"
              className="h-[46px] rounded-xl px-6 text-base"
              onPress={() =>
                router.push(edit ? `/meetings/${edit.code}` : "/upcoming")
              }
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
        <InvitationCard meeting={meeting} saved={Boolean(edit)} />
      </div>
      {scoping ? (
        <ScopeDialog
          title={t("editSeries")}
          confirm={t("ok")}
          onConfirm={(scope) => {
            setScoping(false);
            void save(scope);
          }}
          onClose={() => setScoping(false)}
        />
      ) : null}
      {scheduled ? (
        <ScheduledDialog
          meeting={{ ...meeting, code: scheduled }}
          onDone={() => router.push(`/meetings/${scheduled}`)}
        />
      ) : null}
    </div>
  );
}
