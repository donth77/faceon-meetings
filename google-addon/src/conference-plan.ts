import type { AddonConference } from "../../src/lib/addon/google/types";
import type { ApiResult } from "./api";
import type { Translate } from "./text";

/** What Calendar's conference details get: FaceOn's meeting, or one of Google's errors. */
export type ConferencePlan =
  | {
      kind: "meeting";
      code: string;
      /** "822 382 5279", as Calendar shows it beside the passcode. */
      meetingId: string;
      joinUrl: string;
      passcode: string | null;
      notes: string;
    }
  | {
      kind: "error";
      type: "AUTHENTICATION" | "PERMANENT" | "TEMPORARY";
      authenticationUrl?: string;
    };

/** FaceOn's answer, as Calendar's conference data. */
export function conferencePlan(
  result: ApiResult<AddonConference>,
  t: Translate,
): ConferencePlan {
  if (result.ok) {
    const { code, joinUrl, passcode, meetingId } = result.data;
    // Calendar already shows the ID and passcode: the note says how joining works.
    return {
      kind: "meeting",
      code,
      meetingId,
      joinUrl,
      passcode,
      notes: t("conference.note"),
    };
  }
  const { code, link } = result.error;
  if (code === "AUTHENTICATION" && link) {
    return { kind: "error", type: "AUTHENTICATION", authenticationUrl: link };
  }
  if (
    code === "PERMANENT" ||
    code === "NOT_AVAILABLE" ||
    code === "INVALID_TOKEN" ||
    code === "BAD_REQUEST" ||
    code === "NOT_FOUND"
  ) {
    return { kind: "error", type: "PERMANENT" };
  }
  return { kind: "error", type: "TEMPORARY" };
}
