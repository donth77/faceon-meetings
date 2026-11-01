import type { MeetingErrorCode } from "./api";

/** A reason someone can't do something in a meeting. The API turns it into a JSON error. */
export class MeetingError extends Error {
  constructor(readonly code: MeetingErrorCode) {
    super(code);
    this.name = "MeetingError";
  }
}
