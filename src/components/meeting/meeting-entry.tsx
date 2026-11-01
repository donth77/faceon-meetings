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
  | { name: "joining" }
  | { name: "waiting" }
  | { name: "room"; admission: Admission; devices: DevicePreferences }
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
  "FULL",
  "NETWORK",
  "BAD_REQUEST",
]);

const toJoinError = (code: MeetingErrorCode | "NETWORK"): JoinErrorKind =>
  RETRYABLE.has(code) ? (code as JoinErrorKind) : "UNAVAILABLE";

/** While waiting for the host, ask again this often. */
const WAITING_RETRY_MS = 5000;

export type MeetingEntryProps = {
  code: string;
  meeting: MeetingSummary;
  viewer: Viewer | null;
};

function JoiningScreen() {
  const t = useTranslations("Meeting");
  return (
    <div
      role="status"
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
  const [step, setStep] = useState<Step>(
    viewer
      ? { name: "prejoin", error: null }
      : { name: "notice", kind: "signIn" },
  );
  const lastJoin = useRef<JoinInput | null>(null);
  const endingForAll = useRef(false);

  useEffect(() => scrubLinkPasscode(), []);

  const join = useCallback(
    async (input: JoinInput, { quiet = false } = {}) => {
      lastJoin.current = input;
      if (!quiet) setStep({ name: "joining" });
      try {
        const result = await meetingApi.join(code, {
          name: input.name,
          passcode: input.passcode,
        });
        if (result.state === "waiting_for_host") {
          setStep({ name: "waiting" });
          return;
        }
        if (input.passcode) rememberPasscode(code, input.passcode);
        endingForAll.current = false;
        setStep({ name: "room", admission: result, devices: input.devices });
      } catch (error) {
        const errorCode =
          error instanceof MeetingRequestError ? error.code : "UNAVAILABLE";
        const notice = errorCode === "NETWORK" ? undefined : NOTICES[errorCode];
        setStep(
          notice
            ? { name: "notice", kind: notice }
            : { name: "prejoin", error: toJoinError(errorCode) },
        );
      }
    },
    [code],
  );

  const waiting = step.name === "waiting";
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      if (lastJoin.current) void join(lastJoin.current, { quiet: true });
    }, WAITING_RETRY_MS);
    return () => clearInterval(timer);
  }, [waiting, join]);

  const handleLeft = useCallback((reason: LeaveReason) => {
    setStep({
      name: "left",
      reason:
        reason === "ended" && endingForAll.current ? "endedByYou" : reason,
    });
  }, []);

  const endForAll = useCallback(async () => {
    endingForAll.current = true;
    try {
      await meetingApi.end(code);
    } catch {
      endingForAll.current = false;
      toast.error(t("endFailed"));
    }
  }, [code, t]);

  const rejoin = () => {
    if (lastJoin.current) void join(lastJoin.current);
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
            onEndForAll={() => void endForAll()}
          />
        </MeetingRoom>
      );
      break;
    }
    default:
      content = viewer ? (
        <PreJoin
          meeting={meeting}
          viewer={viewer}
          initialPasscode={initialPasscode}
          status={step.name === "prejoin" ? "idle" : step.name}
          error={step.name === "prejoin" ? step.error : null}
          onJoin={(input) => void join(input)}
          onStopWaiting={() => setStep({ name: "prejoin", error: null })}
        />
      ) : (
        <MeetingNotice kind="signIn" code={code} />
      );
  }

  const inRoom = step.name === "room";
  return (
    <>
      {content}
      <Toaster
        {...(inRoom ? { theme: "dark" as const } : {})}
        position={isMobile ? "top-center" : "bottom-left"}
        offset={inRoom && !isMobile ? { bottom: 104 } : undefined}
      />
    </>
  );
}
