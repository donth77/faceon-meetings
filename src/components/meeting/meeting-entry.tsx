"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DevicePreferences } from "@/lib/device/preferences";
import type { JoinResponse, MeetingErrorCode } from "@/lib/meetings/api";

import { meetingApi, MeetingRequestError } from "./api-client";
import { playSound } from "./chime";
import { LeftMeeting, type LeftReason } from "./left-meeting";
import {
  readLinkPasscode,
  rememberPasscode,
  scrubLinkPasscode,
} from "./link-passcode";
import type { LeaveReason } from "./media";
import { MeetingNotice, type NoticeKind } from "./meeting-notice";
import { useMeetingTitle } from "./meeting-title";
import {
  PreJoin,
  type JoinErrorKind,
  type JoinInput,
  type MeetingSummary,
  type Viewer,
} from "./pre-join/pre-join";
import { MeetingRoom } from "./room/meeting-room";
import { MeetingShell } from "./room/meeting-shell";

type Admission = Extract<JoinResponse, { state: "admitted" }>;

type Step =
  | { name: "prejoin"; error: JoinErrorKind | null }
  /** Asking the API to join; on a rejoin, without showing pre-join again. */
  | { name: "joining"; rejoin?: boolean }
  | { name: "waiting" }
  /** In the waiting room: asked to join, polling until a host decides. */
  | { name: "asking"; requestId: string }
  | {
      name: "room";
      admission: Admission;
      devices: DevicePreferences;
      /** When the session's time limit runs out, on this device's clock. */
      endsAt: number | null;
    }
  | { name: "left"; reason: LeftReason }
  | { name: "notice"; kind: NoticeKind };

/** Errors that end the visit, instead of letting the person try again from pre-join. */
const NOTICES: Partial<Record<MeetingErrorCode, NoticeKind>> = {
  NOT_FOUND: "notFound",
  ENDED: "ended",
  SIGN_IN_REQUIRED: "signIn",
  REMOVED: "removed",
};

const RETRYABLE: ReadonlySet<string> = new Set<JoinErrorKind>([
  "BAD_PASSCODE",
  "LOCKED",
  "DENIED",
  "FULL",
  "BUSY",
  "DEMO_LIMIT",
  "RATE_LIMITED",
  "NETWORK",
  "BAD_REQUEST",
]);

const toJoinError = (code: MeetingErrorCode | "NETWORK"): JoinErrorKind =>
  RETRYABLE.has(code) ? (code as JoinErrorKind) : "UNAVAILABLE";

/** The host's "mute people when they join" settings apply to everyone but hosts. */
function entryDevices(
  devices: DevicePreferences,
  { meeting, self }: Admission,
): DevicePreferences {
  if (self.role === "host" || self.role === "cohost") return devices;
  return {
    ...devices,
    micOn: devices.micOn && !meeting.muteOnEntry,
    cameraOn: devices.cameraOn && !meeting.videoOffOnEntry,
  };
}

/** While waiting for the host, ask again this often. */
const WAITING_RETRY_MS = 5000;
/** In the waiting room, check this often, so being let in feels immediate. */
const ASKING_POLL_MS = 2000;

export type MeetingEntryProps = {
  code: string;
  meeting: MeetingSummary;
  viewer: Viewer;
};

function JoiningScreen() {
  const t = useTranslations("Meeting");
  return (
    <div
      role="status"
      data-fullscreen
      className="dark bg-background text-foreground flex h-dvh flex-col items-center justify-center gap-3"
    >
      <LoaderCircle
        className="size-8 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p>{t("joining")}</p>
    </div>
  );
}

/**
 * The meeting client: pre-join → (waiting for the host) → the room → left. It holds the
 * admission, asks the API to join or end, and loads the room for the session's provider.
 */
export default function MeetingEntry({
  code,
  meeting,
  viewer,
}: MeetingEntryProps) {
  const t = useTranslations("Meeting");
  const isMobile = useIsMobile();
  const title = useMeetingTitle(meeting);
  const [initialPasscode] = useState(() => readLinkPasscode(code));
  const [step, setStep] = useState<Step>({ name: "prejoin", error: null });
  const lastJoin = useRef<JoinInput | null>(null);
  const endingForAll = useRef(false);
  const endsAt = useRef<number | null>(null);
  const leftAlone = useRef(false);

  useEffect(() => scrubLinkPasscode(), []);

  const enter = useCallback(
    (admission: Admission, input: JoinInput) => {
      if (input.passcode) rememberPasscode(code, input.passcode);
      endingForAll.current = false;
      leftAlone.current = false;
      const { secondsLeft } = admission.session;
      endsAt.current =
        secondsLeft === null ? null : Date.now() + secondsLeft * 1000;
      setStep({
        name: "room",
        admission,
        devices: entryDevices(input.devices, admission),
        endsAt: endsAt.current,
      });
    },
    [code],
  );

  /** A failed request: a notice that ends the visit, or an error on pre-join. */
  const fail = useCallback((error: unknown) => {
    const errorCode =
      error instanceof MeetingRequestError ? error.code : "UNAVAILABLE";
    const notice = errorCode === "NETWORK" ? undefined : NOTICES[errorCode];
    setStep(
      notice
        ? { name: "notice", kind: notice }
        : { name: "prejoin", error: toJoinError(errorCode) },
    );
  }, []);

  const join = useCallback(
    async (input: JoinInput, { quiet = false, rejoin = false } = {}) => {
      lastJoin.current = input;
      if (!quiet) setStep({ name: "joining", rejoin });
      try {
        const result = await meetingApi.join(code, {
          name: input.name,
          passcode: input.passcode,
        });
        if (result.state === "waiting_for_host") {
          setStep({ name: "waiting" });
        } else if (result.state === "waiting") {
          setStep({ name: "asking", requestId: result.requestId });
        } else {
          enter(result, input);
        }
      } catch (error) {
        fail(error);
      }
    },
    [code, enter, fail],
  );

  const waiting = step.name === "waiting";
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      if (lastJoin.current) void join(lastJoin.current, { quiet: true });
    }, WAITING_RETRY_MS);
    return () => clearInterval(timer);
  }, [waiting, join]);

  // In the waiting room: poll until a host decides, at once when the tab comes back
  // into view, and give up the place when the tab closes.
  const askingId = step.name === "asking" ? step.requestId : null;
  useEffect(() => {
    if (!askingId) return;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll(requestId: string) {
      clearTimeout(timer);
      try {
        const result = await meetingApi.pollAdmission(code, requestId);
        if (done) return;
        if (result.state === "admitted") {
          done = true;
          playSound("admitted");
          navigator.vibrate?.(200);
          if (lastJoin.current) enter(result, lastJoin.current);
          return;
        }
        if (result.state !== "waiting") {
          done = true;
          setStep({
            name: "prejoin",
            error: result.state === "denied" ? "TURNED_AWAY" : "EXPIRED",
          });
          return;
        }
      } catch (error) {
        if (done) return;
        // A dropped connection just means trying again; anything else ends the wait.
        if (!(
          error instanceof MeetingRequestError && error.code === "NETWORK"
        )) {
          done = true;
          fail(error);
          return;
        }
      }
      timer = setTimeout(() => void poll(requestId), ASKING_POLL_MS);
    }
    const requestId = askingId;
    timer = setTimeout(() => void poll(requestId), ASKING_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && !done) void poll(requestId);
    };
    const onPageHide = () => {
      void meetingApi.cancelAdmission(code, requestId, true).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      done = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [askingId, code, enter, fail]);

  function stopWaiting() {
    if (askingId) {
      void meetingApi.cancelAdmission(code, askingId).catch(() => {});
    }
    setStep({ name: "prejoin", error: null });
  }

  const handleLeft = useCallback((reason: LeaveReason) => {
    // Once this host has asked to end the meeting, however the room closes, they ended it.
    // A call that ends as its time runs out reached its limit, whatever the notice said.
    const timeUp =
      endsAt.current !== null && Date.now() >= endsAt.current - 10_000;
    setStep({
      name: "left",
      reason: endingForAll.current
        ? "endedByYou"
        : reason === "ended" && timeUp
          ? "timeLimit"
          : reason === "left" && leftAlone.current
            ? "alone"
            : reason,
    });
  }, []);

  // Ending takes the server a moment (and Stream's "ended" a moment more), so the host
  // leaves at once while the meeting ends for everyone else.
  const endForAll = useCallback(async () => {
    endingForAll.current = true;
    setStep({ name: "left", reason: "endedByYou" });
    const end = async () => {
      try {
        await meetingApi.end(code);
      } catch {
        toast.error(t("endFailed"), {
          action: { label: t("tryAgain"), onClick: () => void end() },
        });
      }
    };
    await end();
  }, [code, t]);

  const rejoin = () => {
    if (lastJoin.current) void join(lastJoin.current, { rejoin: true });
    else setStep({ name: "prejoin", error: null });
  };

  let content: ReactNode;
  switch (step.name) {
    case "notice":
      content = <MeetingNotice kind={step.kind} code={code} />;
      break;
    case "left":
      content = (
        <LeftMeeting
          reason={step.reason}
          title={title}
          code={code}
          onRejoin={rejoin}
        />
      );
      break;
    case "room": {
      const { admission } = step;
      content = (
        <MeetingRoom
          connection={admission.connection}
          self={admission.self}
          devices={step.devices}
          refreshToken={() => meetingApi.token(code, admission.connection.room)}
          onLeft={handleLeft}
          fallback={<JoiningScreen />}
        >
          <MeetingShell
            meeting={admission.meeting}
            self={admission.self}
            session={admission.session}
            endsAt={step.endsAt}
            onEndForAll={() => void endForAll()}
            onAloneTimeout={() => {
              leftAlone.current = true;
            }}
          />
        </MeetingRoom>
      );
      break;
    }
    default:
      // Rejoining from the left screen goes straight back in, without pre-join.
      content =
        step.name === "joining" && step.rejoin ? (
          <JoiningScreen />
        ) : (
          <PreJoin
            meeting={meeting}
            viewer={viewer}
            initialPasscode={initialPasscode}
            status={step.name === "prejoin" ? "idle" : step.name}
            error={step.name === "prejoin" ? step.error : null}
            onJoin={(input) => void join(input)}
            onStopWaiting={stopWaiting}
          />
        );
  }

  const inRoom = step.name === "room";
  return (
    <>
      {content}
      <Toaster
        // In the room, toasts use the dark tokens too (the toaster sits outside its .dark).
        {...(inRoom
          ? { theme: "dark" as const, className: "toaster group dark" }
          : {})}
        position={isMobile ? "top-center" : "bottom-left"}
        offset={inRoom && !isMobile ? { bottom: 104 } : undefined}
      />
    </>
  );
}
