/**
 * How exports write times and name files: a spreadsheet-friendly local time, file names
 * every system accepts, and the download header that carries them.
 */

/** "2026-11-02 14:05" in a time zone: sorts as text and reads as a date in spreadsheets. */
export function spreadsheetTime(at: Date | string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(typeof at === "string" ? new Date(at) : at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

/** "2026-11-02": the day of a moment in a time zone. */
export function spreadsheetDay(at: Date | string, timeZone: string): string {
  return spreadsheetTime(at, timeZone).slice(0, 10);
}

/** A file name without characters file systems reject, trimmed to a sensible length. */
export function fileName(name: string): string {
  const cleaned = name
    .replace(/[\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
    .trim();
  return cleaned || "FaceOn";
}

/**
 * The Content-Disposition for a download: an ASCII name for old clients, and the real
 * one (any language) for the rest.
 */
export function attachment(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replaceAll('"', "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** The file name a download's Content-Disposition gives, preferring the UTF-8 one. */
export function fileNameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8);
    } catch {
      // A malformed name: fall back to the plain one.
    }
  }
  return /filename="([^"]*)"/i.exec(disposition)?.[1] ?? null;
}
