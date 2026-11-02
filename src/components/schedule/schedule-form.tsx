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
import { useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { GoogleCalendarField } from "@/components/google-calendar/calendar-field";
import {
  CalendarOutcomeNote,
  useCalendarProblemToast,
} from "@/components/google-calendar/outcome";
import { AutoNotesRow, ShareNotesRow } from "@/components/notes/auto-notes-row";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import {
  Field,
  INPUT,
  SelectField,
  SwitchRow,
} from "@/components/ui/form-fields";
import { LengthHint } from "@/components/ui/length-hint";
import type {
  CalendarConnection,
  CalendarOutcome,
} from "@/lib/google-calendar/shared";
import { announceMeetingsChanged } from "@/lib/meetings/changes";
import { passcodeProblem, randomPasscode } from "@/lib/meetings/codes";
import type { Recurrence } from "@/lib/meetings/recurrence";
import {
  MAX_DESCRIPTION,
  MAX_TITLE,
  type ScheduleDraft,
  type ScheduleInput,
  type SeriesScope,
} from "@/lib/meetings/schedule";
import {
  scheduleMeetingAction,
  updateScheduleAction,
} from "@/lib/meetings/schedule-actions";
import { useIntlLocale } from "@/lib/preferences";
import {
  formatDuration,
  localParts,
  viewerTimeZone,
  zonedToUtc,
} from "@/lib/time";

import { DateField } from "./date-field";
import { useScheduledInvitation, type ScheduledMeeting } from "./invitation";
import { CohostsField, InviteesField } from "./invitees-field";
import { PasscodeField } from "./passcode-field";
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
  /** Named co-hosts: they join as co-hosts when signed in with these addresses. */
  cohosts: string[];
  passcode: boolean;
  /** The passcode itself: the one generated, or the host's own. */
  passcodeText: string;
  waitingRoom: boolean;
  allowGuests: boolean;
  joinBeforeHost: boolean;
  muteOnEntry: boolean;
  /** AI notes start by themselves when you or a co-host joins. */
  autoNotes: boolean;
  /** AI notes are saved and shared with the participants as soon as they're made. */
  shareNotes: boolean;
  /** Add it to the host's Google Calendar (Calendar sync). */
  googleCalendar: boolean;
};

/** The host's Google Calendar, for the form's "Add to my Google Calendar" row. */
export type ScheduleCalendar = {
  connection: CalendarConnection;
  /** The host's email, so Google's consent screen offers the matching account. */
  email: string;
  /** Editing a meeting that's already on the calendar. */
  synced: boolean;
};

const DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480];
const TIMES = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

/** The next half hour, in the viewer's time zone: a sensible start for a new meeting. */
const nextHalfHour = (timeZone: string) =>
  localParts(new Date(Math.ceil(Date.now() / 1_800_000) * 1_800_000), timeZone);

export function defaultValues(): ScheduleFormValues {
  const timeZone = viewerTimeZone();
  return {
    title: "",
    description: "",
    ...nextHalfHour(timeZone),
    durationMin: 60,
    timeZone,
    recurrence: null,
    invitees: [],
    cohosts: [],
    passcode: true,
    passcodeText: "",
    waitingRoom: true,
    allowGuests: true,
    joinBeforeHost: false,
    muteOnEntry: false,
    autoNotes: false,
    shareNotes: false,
    googleCalendar: false,
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

const toInput = (values: ScheduleFormValues): ScheduleInput => ({
  title: values.title,
  description: values.description,
  start: `${values.date}T${values.time}`,
  timeZone: values.timeZone,
  durationMin: values.durationMin,
  recurrence: values.recurrence,
  passcode: values.passcode,
  passcodeText: values.passcode ? values.passcodeText.trim() : undefined,
  waitingRoom: values.waitingRoom,
  allowGuests: values.allowGuests,
  joinBeforeHost: values.joinBeforeHost && !values.waitingRoom,
  muteOnEntry: values.muteOnEntry,
  autoNotes: values.autoNotes,
  shareNotes: values.shareNotes,
  invitees: values.invitees,
  cohosts: values.cohosts,
  googleCalendar: values.googleCalendar,
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
  calendar,
  email,
  onDone,
}: {
  meeting: ScheduledMeeting;
  /** What Google Calendar did with it, when the host added it there. */
  calendar: CalendarOutcome | undefined;
  email: string;
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
      {calendar ? (
        <CalendarOutcomeNote
          outcome={calendar}
          code={meeting.code}
          invited={
            meeting.invitees.filter(
              (invitee) => invitee !== email.toLowerCase(),
            ).length
          }
          email={email}
        />
      ) : null}
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
  calendar,
  aiNotesAllowed,
  draft,
  initial,
  edit,
}: {
  hostName: string;
  calendar: ScheduleCalendar;
  /** The host's meetings offer AI notes (Settings → AI notes). */
  aiNotesAllowed: boolean;
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
  const tc = useTranslations("GoogleCalendar");
  const tp = useTranslations("Passcode");
  const locale = useIntlLocale();
  const router = useRouter();
  const showCalendarProblem = useCalendarProblemToast(calendar.email);
  const ids = { title: useId(), date: useId(), description: useId() };
  const [values, setValues] = useState<ScheduleFormValues>(
    () =>
      edit?.values ?? {
        ...defaultValues(),
        // Once Google Calendar is connected, new meetings go on it unless switched off.
        googleCalendar: calendar.connection.status === "connected",
        // The previewed passcode, which the host can keep or change.
        passcodeText: draft?.passcode ?? "",
        ...initial,
      },
  );
  const [saving, setSaving] = useState(false);
  const [scoping, setScoping] = useState(false);
  // A passcode that can't be used shows what's wrong once saving is tried.
  const [triedSave, setTriedSave] = useState(false);
  const passcodeInput = useRef<HTMLInputElement>(null);
  // Changing an edited meeting's passcode stops the old one and its links working.
  const [confirmingPasscode, setConfirmingPasscode] = useState(false);
  const [scheduled, setScheduled] = useState<{
    code: string;
    calendar: CalendarOutcome | undefined;
  } | null>(null);
  const set = (patch: Partial<ScheduleFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const code = edit?.code ?? draft?.code ?? "";
  const passcode = values.passcode ? values.passcodeText.trim() || null : null;
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
    // Named co-hosts are invited too.
    invitees: [...values.invitees, ...values.cohosts],
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
      announceMeetingsChanged();
      if (edit) {
        toast.success(t("saved"), {
          description: result.calendar === "synced" ? tc("updated") : undefined,
        });
        showCalendarProblem(result.calendar, edit.code);
        router.push(`/meetings/${edit.code}`);
      } else {
        setScheduled({ code: result.code, calendar: result.calendar });
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  /** Saves, asking first which meetings of a series an edit is for. */
  function proceed() {
    if (edit?.isSeries && edit.occurrence) setScoping(true);
    else void save("all");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.title.trim()) return;
    if (values.passcode && passcodeProblem(values.passcodeText)) {
      setTriedSave(true);
      passcodeInput.current?.focus();
      return;
    }
    // Capital letters don't matter to anyone joining, so only a real change asks.
    const changed =
      edit?.passcode != null &&
      values.passcode &&
      values.passcodeText.trim().toUpperCase() !== edit.passcode.toUpperCase();
    if (changed) setConfirmingPasscode(true);
    else proceed();
  }

  const timeOptions = TIMES.map((time) => ({
    id: time,
    label: formatTime(time, locale),
  }));
  const durationOptions = DURATIONS.map((minutes) => ({
    id: String(minutes),
    label: formatDuration(minutes, locale, "long"),
  }));

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
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
              maxLength={MAX_TITLE}
              value={values.title}
              onChange={(event) => set({ title: event.target.value })}
              aria-describedby={`${ids.title}-length`}
              className={INPUT}
            />
            <LengthHint
              id={`${ids.title}-length`}
              length={values.title.length}
              max={MAX_TITLE}
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
              maxLength={MAX_DESCRIPTION}
              value={values.description}
              onChange={(event) => set({ description: event.target.value })}
              aria-describedby={`${ids.description}-length`}
              className={`${INPUT} h-auto resize-y py-2.5`}
            />
            <LengthHint
              id={`${ids.description}-length`}
              length={values.description.length}
              max={MAX_DESCRIPTION}
            />
          </Field>
          <InviteesField
            label={t("invitePeople")}
            optional={t("optional")}
            value={values.invitees}
            onChange={(invitees) =>
              set({
                invitees: invitees.filter((e) => !values.cohosts.includes(e)),
              })
            }
          />
          <CohostsField
            value={values.cohosts}
            onChange={(cohosts) =>
              // Each address on one list: a co-host is invited as one.
              set({
                cohosts,
                invitees: values.invitees.filter((e) => !cohosts.includes(e)),
              })
            }
            hostEmail={calendar.email}
            help={t("cohostsHelp")}
          />
          <GoogleCalendarField
            connection={calendar.connection}
            synced={calendar.synced}
            value={values.googleCalendar}
            onChange={(googleCalendar) => set({ googleCalendar })}
            email={calendar.email}
          />
          <fieldset className="flex flex-col">
            <legend className="text-muted-foreground mb-1 text-[13px] font-bold tracking-[0.06em] uppercase">
              {t("security")}
            </legend>
            <SwitchRow
              label={t("requirePasscode")}
              help={values.passcode ? t("passcodeInLink") : undefined}
              isSelected={values.passcode}
              onChange={(on) =>
                set({
                  passcode: on,
                  // Turned on with none yet: a generated one to start from.
                  ...(on && !values.passcodeText.trim()
                    ? { passcodeText: randomPasscode() }
                    : {}),
                })
              }
            />
            {values.passcode ? (
              <div className="pt-1 pb-3">
                <PasscodeField
                  value={values.passcodeText}
                  onChange={(passcodeText) => set({ passcodeText })}
                  showProblem={triedSave}
                  inputRef={passcodeInput}
                />
              </div>
            ) : null}
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
            <AutoNotesRow
              allowed={aiNotesAllowed}
              isSelected={values.autoNotes}
              onChange={(on) => set({ autoNotes: on })}
            />
            <ShareNotesRow
              allowed={aiNotesAllowed}
              isSelected={values.shareNotes}
              onChange={(on) => set({ shareNotes: on })}
            />
          </fieldset>
          <div className="flex gap-2">
            <Button
              type="submit"
              isPending={saving}
              className="h-[46px] rounded-xl px-6 text-base"
            >
              {saving ? (
                <LoaderCircle
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
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
      {confirmingPasscode ? (
        <ConfirmDialog
          isOpen
          onClose={() => setConfirmingPasscode(false)}
          title={tp("changeTitle")}
          description={tp("changeBody")}
          confirmLabel={tp("changeConfirm")}
          cancelLabel={tp("cancel")}
          onConfirm={() => {
            setConfirmingPasscode(false);
            proceed();
          }}
        />
      ) : null}
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
          meeting={{ ...meeting, code: scheduled.code }}
          calendar={scheduled.calendar}
          email={calendar.email}
          onDone={() => router.push(`/meetings/${scheduled.code}`)}
        />
      ) : null}
    </div>
  );
}
