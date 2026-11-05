"use client";

import { cn } from "cn";
import {
  Crown,
  Info,
  LoaderCircle,
  Mic,
  MicOff,
  Settings,
  Sparkles,
  Video,
  VideoOff,
  Volume2,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button as AriaButton } from "react-aria-components";
import { UNSAFE_PortalProvider } from "react-aria/PortalProvider";

import { DeviceProblemNote } from "@/components/device/device-problem-note";
import { MicMeter } from "@/components/device/mic-meter";
import { MirroredVideo } from "@/components/device/mirrored-video";
import { useLocalTrack } from "@/components/device/use-local-track";
import { useNoiseSuppression } from "@/components/device/use-noise-suppression";
import { useNoiseTrack } from "@/components/device/use-noise-track";
import { useEffectProblems } from "@/components/effects/use-effect-problems";
import { useEffectsTrack } from "@/components/effects/use-effects-track";
import { useHumanCheck } from "@/components/human-check/use-human-check";
import { LegalConsent } from "@/components/legal/legal-links";
import { SpeechDownload } from "@/components/notes/speech-download";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { useCapability } from "@/hooks/use-capability";
import { useMediaDevices } from "@/hooks/use-media-devices";
import {
  loadDevicePreferences,
  saveDevicePreferences,
  type DevicePreferences,
} from "@/lib/device/preferences";
import { playTestSound } from "@/lib/device/test-sound";
import { availableEffect } from "@/lib/effects/support";
import { publicEnv } from "@/lib/env";
import type { MeetingLimits } from "@/lib/meetings/api";
import { formatMeetingCode } from "@/lib/meetings/codes";
import { browserSuppression } from "@/lib/noise/noise";
import {
  loadPreferences,
  usePreferences,
  withDefaults,
} from "@/lib/preferences";
import { meetingPath, signInPath } from "@/lib/routes";

import { loadGuestName, saveGuestName } from "../guest-name";
import { useMeetingTitle } from "../meeting-title";
import { MeetingPageFrame } from "../page-frame";
import {
  SettingsDialog,
  type InCallSection,
  type SettingsDevices,
} from "../room/in-call-settings";
import { EffectsDialog } from "./effects-dialog";
import { ChangeAvatar, type JoinAvatar, type Viewer } from "./join-avatar";

export type MeetingSummary = {
  code: string;
  title: string | null;
  hostName: string;
  /** The waiting room is on and you aren't the host: Join now becomes Ask to join. */
  askToJoin: boolean;
  /** AI notes are on in the meeting now, so everyone joining is told. */
  notesOn: boolean;
  /** ...for a transcript only, which is what they're told. */
  notesTranscriptOnly: boolean;
  /** AI notes start by themselves once a host or co-host is in: told in advance too. */
  notesAuto: boolean;
  /** AI notes are shared with the participants as soon as they're made: said up front. */
  notesShared: boolean;
  limits: MeetingLimits;
  /** You're the meeting's host. */
  youHost: boolean;
  /** Joining will need the meeting's passcode (it has one, and you aren't let in yet). */
  needsPasscode: boolean;
  /** You'll join as a co-host (the meeting names you, or a host made you one), so you're told. */
  youCohost: boolean;
};

export type JoinInput = {
  name: string;
  passcode: string | undefined;
  devices: DevicePreferences;
  /** A guest's avatar, as the join screen showed it. */
  avatarSeed: string | undefined;
  /** The check's token, for a guest's first join from this browser. */
  humanCheck?: string | undefined;
};

/** Why the last join attempt failed, in the terms the error messages use. */
export type JoinErrorKind =
  | "BAD_PASSCODE"
  | "LOCKED"
  /** Turned away too often to ask again. */
  | "DENIED"
  /** A host didn't let you in this time. */
  | "TURNED_AWAY"
  /** Nobody answered the request in time. */
  | "EXPIRED"
  | "FULL"
  | "BUSY"
  | "DEMO_LIMIT"
  | "RATE_LIMITED"
  | "HUMAN_CHECK_FAILED"
  | "NETWORK"
  | "UNAVAILABLE"
  | "BAD_REQUEST";

/** A round on/off control on the preview, red while off, as in Meet. */
function PreviewToggle({
  on,
  label,
  iconOn,
  iconOff,
  onPress,
}: {
  on: boolean;
  label: string;
  iconOn: LucideIcon;
  iconOff: LucideIcon;
  onPress: () => void;
}) {
  const Icon = on ? iconOn : iconOff;
  return (
    <AriaButton
      aria-label={label}
      onPress={onPress}
      className={cn(
        "focus-visible:focus-ring flex size-14 items-center justify-center rounded-full outline-hidden",
        on
          ? "bg-[#262b33]/90 text-[#f2f4f7] hover:bg-[#303741]"
          : "bg-destructive-fill hover:bg-destructive-fill/90 text-white",
      )}
    >
      <Icon className="size-6" aria-hidden="true" />
    </AriaButton>
  );
}

function DeviceSelect({
  label,
  devices,
  value,
  onChange,
}: {
  label: string;
  devices: MediaDeviceInfo[];
  value: string | undefined;
  onChange: (deviceId: string) => void;
}) {
  const t = useTranslations("Meeting");
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-muted-foreground text-[13px] font-semibold"
      >
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={devices.length === 0}
        className="border-input bg-card focus-visible:focus-ring h-11 w-full min-w-0 truncate rounded-[10px] border px-2.5 text-[15px] outline-hidden disabled:opacity-60"
      >
        {devices.length === 0 ? (
          <option value="">{t("noDevices")}</option>
        ) : (
          devices.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || t("deviceNumber", { n: index + 1 })}
            </option>
          ))
        )}
      </select>
    </div>
  );
}

/**
 * The pre-join screen: a live preview with mic and camera toggles, device choices, a mic
 * meter and test sound, then name (and passcode when needed) and Join now.
 */
export function PreJoin({
  meeting,
  viewer,
  avatar,
  initialPasscode,
  status,
  error,
  onJoin,
  onStopWaiting,
  desktopOffer,
}: {
  meeting: MeetingSummary;
  viewer: Viewer;
  avatar: JoinAvatar;
  /** On a computer: a quiet offer of the desktop app, where there's one to get. */
  desktopOffer?: ReactNode;
  initialPasscode: string | undefined;
  status: "idle" | "joining" | "waiting" | "asking";
  error: JoinErrorKind | null;
  onJoin: (input: JoinInput) => void;
  onStopWaiting: () => void;
}) {
  const t = useTranslations("PreJoin");
  const tm = useTranslations("Meeting");
  const te = useTranslations("Effects");
  const title = useMeetingTitle(meeting);
  const nameId = useId();
  const passcodeId = useId();
  const passcodeHintId = useId();
  const errorId = useId();
  // A guest's join may need a person behind it, where this copy checks (Turnstile): the
  // first from this browser, and any while the meeting has had many wrong passcodes. The
  // check is ready either way; the server asks for its token only then.
  const humanCheck = useHumanCheck(
    "guest-join",
    viewer.kind === "guest" && viewer.humanCheck === true,
  );
  const [checking, setChecking] = useState(false);

  const settings = withDefaults(usePreferences());
  // Settings → Video can start every meeting with the camera off.
  const [devices, setDevices] = useState(() => {
    const remembered = loadDevicePreferences();
    return withDefaults(loadPreferences()).cameraOffOnJoin
      ? { ...remembered, cameraOn: false }
      : remembered;
  });
  const [name, setName] = useState(() =>
    viewer.kind === "guest" ? loadGuestName() : viewer.name,
  );
  const [passcode, setPasscode] = useState(initialPasscode ?? "");
  /** The passcode the last Join sent: a refusal says it was wrong only if there was one. */
  const [sentPasscode, setSentPasscode] = useState<string | undefined>();
  const passcodeField = useRef<HTMLInputElement>(null);

  // On a first visit, a guest's default avatar takes the look their name suggests, once
  // they stop typing.
  const followName = useEffectEvent((typed: string) =>
    avatar.followName(typed),
  );
  useEffect(() => {
    const timer = setTimeout(() => followName(name), 400);
    return () => clearTimeout(timer);
  }, [name]);
  const video = useLocalTrack("video", devices.cameraOn, devices.cameraId);
  const noise = useNoiseSuppression();
  const audio = useLocalTrack(
    "audio",
    devices.micOn,
    devices.micId,
    browserSuppression(noise.mode),
  );
  // The meter shows what others would hear, with strong suppression when it's on.
  const heard = useNoiseTrack(audio.track, noise.mode);
  const lists = useMediaDevices(`${video.track?.id}|${audio.track?.id}`);

  // Only what you change here is remembered: "Join with camera off" in Settings turns
  // the camera off for this meeting without making that stick.
  function update(patch: Partial<DevicePreferences>) {
    setDevices((current) => ({ ...current, ...patch }));
    saveDevicePreferences({ ...loadDevicePreferences(), ...patch });
  }
  const canUseEffects = useCapability("effects");
  // Without WebRTC, joining could only end in "You lost your connection".
  const canCall = useCapability("calls");
  const chooseSpeaker = useCapability("chooseSpeaker");
  const [choosingEffect, setChoosingEffect] = useState(false);
  const effect = canUseEffects ? availableEffect(settings.effect) : null;
  // With a background on, the preview shows it, and never the bare camera meanwhile.
  const preview = useEffectsTrack(video.track, effect, useEffectProblems());

  // The meeting's Settings, here before joining, as in Meet: the preview stands in for
  // the room's microphone and camera, and everything chosen carries into the meeting.
  const [settingsSection, setSettingsSection] = useState<InCallSection | null>(
    null,
  );
  const settingsLayer = useRef<HTMLDivElement>(null);
  const previewDevices: SettingsDevices = {
    mic: {
      // What others would hear: the meter follows noise suppression as it changes.
      track: heard,
      devices: lists.microphones,
      selectedId: devices.micId ?? audio.track?.getSettings().deviceId,
      select: (micId) => update({ micId }),
    },
    camera: {
      track: preview,
      enabled: devices.cameraOn,
      allowed: true,
      devices: lists.cameras,
      selectedId: devices.cameraId ?? video.track?.getSettings().deviceId,
      select: (cameraId) => update({ cameraId }),
      toggle: () => update({ cameraOn: !devices.cameraOn }),
    },
    speaker: {
      supported: chooseSpeaker,
      devices: lists.speakers,
      selectedId: devices.speakerId,
      select: (speakerId) => update({ speakerId }),
    },
  };

  // Asking to join, waiting, and coming back replace the button you pressed, so focus
  // goes to the new heading, and the status region below says what's happening.
  const heading = useRef<HTMLHeadingElement>(null);
  const shownStatus = useRef(status);
  useEffect(() => {
    const before = shownStatus.current;
    shownStatus.current = status;
    const waitingNow = status === "asking" || status === "waiting";
    const waitingBefore = before === "asking" || before === "waiting";
    if (waitingNow !== waitingBefore || (waitingNow && status !== before)) {
      heading.current?.focus();
    }
  }, [status]);

  const busy = status !== "idle";
  const signInHref = signInPath(meetingPath(meeting.code));
  // Asked up front when the meeting will need it and the link didn't bring it, and after
  // the meeting turns down a Join without one. Only a passcode that was sent is wrong.
  const showPasscode =
    (meeting.needsPasscode && !initialPasscode) || error === "BAD_PASSCODE";
  const shownError =
    error === "BAD_PASSCODE" && sentPasscode === undefined ? null : error;
  const canJoin =
    name.trim() !== "" && !(showPasscode && passcode.trim() === "");
  const { limits } = meeting;
  const errorMessage = !shownError
    ? null
    : shownError === "FULL" && limits.demo
      ? t("errors.demoFull", { count: limits.people })
      : shownError === "DEMO_LIMIT" && meeting.youHost
        ? t("errors.demoLimitYou", { count: limits.demoPerDay })
        : t(`errors.${shownError}`, {
            appName: publicEnv.NEXT_PUBLIC_APP_NAME,
          });

  // The meeting turned the passcode down (or wants one): the field is where to go next.
  useEffect(() => {
    if (error !== "BAD_PASSCODE") return;
    passcodeField.current?.focus();
    passcodeField.current?.select();
  }, [error]);

  async function join(withDevices: DevicePreferences) {
    if (viewer.kind === "guest") saveGuestName(name.trim());
    // The avatar on screen now is the one they join with: the bot check below can take
    // a while, and a name's look arriving meanwhile would change the screen but not
    // what this join sends.
    avatar.keep();
    setChecking(true);
    const token = await humanCheck.take();
    setChecking(false);
    // The check says what went wrong, with Try again.
    if (token === null) return;
    const sent = passcode.trim() || undefined;
    setSentPasscode(sent);
    onJoin({
      name,
      passcode: sent,
      devices: withDevices,
      avatarSeed: avatar.joinSeed,
      humanCheck: token,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void join(devices);
  }

  return (
    <>
      <MeetingPageFrame
        signInHref={viewer.kind === "guest" ? signInHref : undefined}
      >
        {/* Phones: preview, then name and Join now, then device settings. Wider: the form
          sits to the right of the preview and settings. */}
        <div className="grid w-full max-w-[1220px] gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
          <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
            <div className="relative aspect-video w-full overflow-hidden rounded-[20px] bg-[#0e1013] text-[#f2f4f7]">
              <TooltipTrigger delay={300}>
                <AriaButton
                  aria-label={tm("settings")}
                  onPress={() => setSettingsSection("audio")}
                  className="focus-visible:focus-ring absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full bg-[#262b33]/90 text-[#f2f4f7] outline-hidden hover:bg-[#303741]"
                >
                  <Settings className="size-5" aria-hidden="true" />
                </AriaButton>
                <Tooltip>{tm("settings")}</Tooltip>
              </TooltipTrigger>
              {preview ? (
                <MirroredVideo track={preview} mirror={settings.mirrorVideo} />
              ) : video.track ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm">
                  <LoaderCircle
                    className="size-8 animate-spin opacity-70 motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  {te("starting")}
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  {video.pending ? (
                    <LoaderCircle
                      className="size-8 animate-spin opacity-70 motion-reduce:animate-none"
                      aria-label={t("startingCamera")}
                    />
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatar.image}
                        alt=""
                        className="size-24 rounded-full sm:size-32"
                      />
                      <span className="text-sm opacity-80">
                        {devices.cameraOn ? null : t("cameraOff")}
                      </span>
                    </>
                  )}
                </div>
              )}
              {effect ? (
                <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
                  <WandSparkles className="size-3.5" aria-hidden="true" />
                  {te("backgroundOn")}
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-4 flex justify-center gap-3.5">
                <PreviewToggle
                  on={devices.micOn}
                  label={devices.micOn ? tm("mute") : tm("unmute")}
                  iconOn={Mic}
                  iconOff={MicOff}
                  onPress={() => update({ micOn: !devices.micOn })}
                />
                <PreviewToggle
                  on={devices.cameraOn}
                  label={devices.cameraOn ? tm("stopVideo") : tm("startVideo")}
                  iconOn={Video}
                  iconOff={VideoOff}
                  onPress={() => update({ cameraOn: !devices.cameraOn })}
                />
              </div>
              {canUseEffects ? (
                // Pick a background before anyone sees you, as in Meet.
                <AriaButton
                  aria-label={te("title")}
                  onPress={() => setChoosingEffect(true)}
                  className="focus-visible:focus-ring absolute right-4 bottom-[22px] flex size-11 items-center justify-center gap-2 rounded-full bg-[#262b33]/90 text-sm font-semibold text-[#f2f4f7] outline-hidden hover:bg-[#303741] sm:w-auto sm:px-3.5"
                >
                  <WandSparkles className="size-[18px]" aria-hidden="true" />
                  <span className="max-sm:hidden">{te("title")}</span>
                </AriaButton>
              ) : null}
            </div>
            {canUseEffects ? (
              <EffectsDialog
                isOpen={choosingEffect}
                onClose={() => setChoosingEffect(false)}
                track={preview}
                cameraOn={devices.cameraOn}
                mirror={settings.mirrorVideo}
                value={effect}
              />
            ) : null}

            {/* Where the browser can't join at all, the note by Join says so instead. */}
            {video.problem && canCall ? (
              <DeviceProblemNote
                device="camera"
                problem={video.problem}
                onRetry={video.retry}
              />
            ) : null}
            {audio.problem && canCall ? (
              <DeviceProblemNote
                device="microphone"
                problem={audio.problem}
                onRetry={audio.retry}
              />
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-2">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-3">
              <DeviceSelect
                label={tm("microphone")}
                devices={lists.microphones}
                value={devices.micId ?? audio.track?.getSettings().deviceId}
                onChange={(micId) => update({ micId })}
              />
              {chooseSpeaker ? (
                <DeviceSelect
                  label={tm("speaker")}
                  devices={lists.speakers}
                  value={devices.speakerId}
                  onChange={(speakerId) => update({ speakerId })}
                />
              ) : null}
              <DeviceSelect
                label={tm("camera")}
                devices={lists.cameras}
                value={devices.cameraId ?? video.track?.getSettings().deviceId}
                onChange={(cameraId) => update({ cameraId })}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
              <MicMeter track={heard} />
              <AriaButton
                onPress={() =>
                  void playTestSound(devices.speakerId).catch(() => {})
                }
                className="text-primary focus-visible:focus-ring flex items-center gap-2 rounded px-0.5 py-1.5 text-sm font-semibold outline-hidden hover:underline"
              >
                <Volume2 className="size-[18px]" aria-hidden="true" />
                {t("testSound")}
              </AriaButton>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex min-w-0 flex-col gap-5 max-lg:row-start-2 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center"
          >
            {status === "asking" ? (
              <>
                <div className="flex flex-col gap-3">
                  <div aria-hidden="true" className="flex gap-2">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        style={{ animationDelay: `${dot * 200}ms` }}
                        className="bg-hand size-2.5 animate-pulse rounded-full motion-reduce:animate-none"
                      />
                    ))}
                  </div>
                  <h1
                    ref={heading}
                    tabIndex={-1}
                    className="font-display text-3xl font-bold tracking-tight text-balance outline-none sm:text-[34px]"
                  >
                    {t("askingTitle")}
                  </h1>
                  <p className="text-muted-foreground">
                    {t("askingMeeting", { title, name: meeting.hostName })}
                  </p>
                </div>
                <p className="bg-muted flex items-start gap-3 rounded-[14px] px-4 py-3.5 text-sm leading-normal">
                  <Info
                    className="text-muted-foreground mt-px size-5 shrink-0"
                    aria-hidden="true"
                  />
                  {t("askingNote")}
                </p>
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p className="text-muted-foreground text-[13px] font-bold tracking-[0.06em] uppercase">
                  {status === "waiting"
                    ? t("waitingEyebrow")
                    : t("readyToJoin")}
                </p>
                <h1
                  ref={heading}
                  tabIndex={-1}
                  className="font-display text-3xl font-bold tracking-tight text-balance outline-none sm:text-[34px]"
                >
                  {title}
                </h1>
                <p className="text-muted-foreground">
                  {t("hostedBy", { name: meeting.hostName })} ·{" "}
                  <span className="font-mono text-sm">
                    {formatMeetingCode(meeting.code)}
                  </span>
                </p>
                {limits.demo && limits.minutes !== null ? (
                  <p className="text-muted-foreground text-sm">
                    {t("demoMeeting", {
                      minutes: limits.minutes,
                      people: limits.people,
                    })}
                  </p>
                ) : null}
              </div>
            )}

            {/* Mounted from the start, so a screen reader hears each change. */}
            <p role="status" className="sr-only">
              {status === "asking"
                ? t("askingNote")
                : status === "waiting"
                  ? t("waitingForHost")
                  : ""}
            </p>

            {meeting.notesOn || meeting.notesAuto ? (
              <div
                role="note"
                className="bg-muted flex items-start gap-3 rounded-[14px] px-4 py-3.5 text-sm leading-normal"
              >
                <Sparkles
                  className="text-primary mt-px size-5 shrink-0"
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-col gap-3">
                  <p>
                    {meeting.notesOn
                      ? t(
                          meeting.notesTranscriptOnly
                            ? "notesOnTranscript"
                            : meeting.notesShared
                              ? "notesOnShared"
                              : "notesOn",
                        )
                      : t(
                          meeting.notesShared ? "notesAutoShared" : "notesAuto",
                        )}
                  </p>
                  {/* The one-time download, before joining rather than in the meeting. */}
                  <SpeechDownload place="preJoin" />
                </div>
              </div>
            ) : null}

            {meeting.youCohost ? (
              <p
                role="note"
                className="bg-muted flex items-start gap-3 rounded-[14px] px-4 py-3.5 text-sm leading-normal"
              >
                <Crown
                  className="text-primary mt-px size-5 shrink-0"
                  aria-hidden="true"
                />
                {t("youCohost")}
              </p>
            ) : null}

            {status === "waiting" ? (
              <p className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm leading-normal text-amber-950 ring-1 ring-amber-200 ring-inset dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/30">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-2.5 shrink-0 rounded-full bg-amber-400"
                />
                {t("waitingForHost")}
              </p>
            ) : null}

            <div className="flex flex-col gap-1.5" hidden={status === "asking"}>
              <label htmlFor={nameId} className="text-sm font-semibold">
                {t("yourName")}
              </label>
              {/* Your avatar beside your name: what people see when your camera is off. */}
              <div className="flex items-center gap-3">
                <ChangeAvatar avatar={avatar} isDisabled={busy} />
                <Input
                  id={nameId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={64}
                  disabled={busy}
                  className="h-12 min-w-0 flex-1 rounded-xl px-3.5 text-base md:text-base"
                />
              </div>
            </div>

            {showPasscode ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={passcodeId} className="text-sm font-semibold">
                  {t("passcode")}
                </label>
                <Input
                  ref={passcodeField}
                  id={passcodeId}
                  value={passcode}
                  onChange={(event) => setPasscode(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={32}
                  disabled={busy}
                  aria-invalid={shownError === "BAD_PASSCODE" || undefined}
                  aria-describedby={
                    shownError === "BAD_PASSCODE"
                      ? `${passcodeHintId} ${errorId}`
                      : passcodeHintId
                  }
                  className="h-12 rounded-xl px-3.5 font-mono text-base tracking-widest md:text-base"
                />
                <p
                  id={passcodeHintId}
                  className="text-muted-foreground text-sm"
                >
                  {t("passcodeHint")}
                </p>
              </div>
            ) : null}

            {errorMessage ? (
              <p id={errorId} role="alert" className="text-destructive text-sm">
                {errorMessage}
              </p>
            ) : null}

            {status === "idle" ? humanCheck.view : null}

            {status === "asking" ? (
              <Button
                variant="outline"
                onPress={onStopWaiting}
                className="border-destructive/40 text-destructive-text hover:bg-destructive/10 hover:text-destructive-text h-[52px] rounded-[14px] text-[16px] font-semibold"
              >
                {t("leaveWaitingRoom")}
              </Button>
            ) : status === "waiting" ? (
              <Button
                variant="outline"
                onPress={onStopWaiting}
                className="h-[52px] rounded-xl text-[17px] font-semibold"
              >
                {t("stopWaiting")}
              </Button>
            ) : !canCall ? (
              <p role="alert" className="text-sm leading-normal">
                {t("cantJoinHere")}
              </p>
            ) : (
              <>
                <Button
                  type="submit"
                  isPending={status === "joining" || checking}
                  isDisabled={!canJoin}
                  className="h-[52px] rounded-xl text-[17px] font-semibold"
                >
                  {status === "joining" ? (
                    <LoaderCircle
                      className="size-5 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : null}
                  {status === "joining"
                    ? t("joining")
                    : meeting.askToJoin
                      ? t("askToJoin")
                      : t("joinNow")}
                </Button>
                <Button
                  variant="link"
                  isDisabled={busy || !canJoin}
                  onPress={() =>
                    void join({ ...devices, micOn: false, cameraOn: false })
                  }
                  className="self-center text-[15px] font-semibold"
                >
                  {t("joinWithout")}
                </Button>
                {desktopOffer}
                {viewer.kind === "guest" ? (
                  <>
                    <p className="text-muted-foreground text-center text-[13px] leading-normal">
                      {t.rich("guestNote", {
                        link: (chunks) => (
                          <Link
                            href={signInHref}
                            className="text-primary font-semibold underline-offset-4 hover:underline"
                          >
                            {chunks}
                          </Link>
                        ),
                      })}
                    </p>
                    {/* Guests have no account, so they agree here, as on Zoom's web client. */}
                    <LegalConsent action="join" className="text-center" />
                  </>
                ) : null}
              </>
            )}
          </form>
        </div>
      </MeetingPageFrame>
      {/* Dark, like the meeting it belongs to, with its menus inside it. */}
      <UNSAFE_PortalProvider getContainer={() => settingsLayer.current}>
        <SettingsDialog
          section={settingsSection}
          onSectionChange={setSettingsSection}
          onClose={() => setSettingsSection(null)}
          devices={previewDevices}
          beforeJoining={status === "idle"}
        />
      </UNSAFE_PortalProvider>
      <div ref={settingsLayer} className="dark" />
    </>
  );
}
