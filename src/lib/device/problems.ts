/** Why a camera or microphone isn't working, in terms the help messages use. */
export type DeviceProblem =
  "blocked" | "notFound" | "inUse" | "unavailableSetting" | "unknown";

/** Maps a getUserMedia error to the help we show for it. */
export function deviceProblem(error: unknown): DeviceProblem {
  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "blocked"; // the person or the browser said no → how to allow it
    case "NotFoundError":
      return "notFound"; // no such device → carry on without it
    case "NotReadableError":
    case "AbortError":
      return "inUse"; // another app holds it (often another meeting app)
    case "OverconstrainedError":
      return "unavailableSetting"; // the remembered device is gone → use the default
    default:
      return "unknown";
  }
}
