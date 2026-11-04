import { z } from "zod";

/** Meeting IDs are 10 random digits that never start with 0, shown as "123 456 7890". */
export const MEETING_CODE_PATTERN = /^[1-9]\d{9}$/;

/**
 * Passcodes, as Zoom allows them: letters, digits and @ - _ *, from 2 (a short one like
 * "FF" is the host's choice; wrong guesses are rate-limited, and generated ones have 6)
 * to 10 characters. Capital letters don't matter when someone types one (passcodeMatches).
 */
export const PASSCODE_MIN = 2;
export const PASSCODE_MAX = 10;
const PASSCODE_CHARS = "A-Za-z0-9@_*-";
export const PASSCODE_PATTERN = new RegExp(
  `^[${PASSCODE_CHARS}]{${PASSCODE_MIN},${PASSCODE_MAX}}$`,
);

/** A passcode a host chose (or kept the generated one): trimmed, as the rules allow. */
export const Passcode = z.string().trim().regex(PASSCODE_PATTERN);

/** Why a passcode can't be used, for its field to say; null when it can. */
export function passcodeProblem(value: string): "characters" | "length" | null {
  const passcode = value.trim();
  if (!new RegExp(`^[${PASSCODE_CHARS}]*$`).test(passcode)) return "characters";
  if (passcode.length < PASSCODE_MIN || passcode.length > PASSCODE_MAX) {
    return "length";
  }
  return null;
}

/** The characters new passcodes use: none that look alike (no 0/O, 1/l/I). */
const PASSCODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** Random bytes from here up are skipped, so every character is as likely as the next. */
const UNBIASED_BELOW =
  Math.floor(256 / PASSCODE_ALPHABET.length) * PASSCODE_ALPHABET.length;

/** A new 6-character passcode, from the platform's secure random numbers (browser or server). */
export function randomPasscode(): string {
  const byte = new Uint8Array(1);
  let passcode = "";
  while (passcode.length < 6) {
    crypto.getRandomValues(byte);
    const value = byte[0] ?? UNBIASED_BELOW;
    if (value < UNBIASED_BELOW) {
      passcode += PASSCODE_ALPHABET[value % PASSCODE_ALPHABET.length];
    }
  }
  return passcode;
}

/** Formats a meeting ID for display: "1234567890" → "123 456 7890". Anything else is returned unchanged. */
export function formatMeetingCode(code: string): string {
  if (!MEETING_CODE_PATTERN.test(code)) return code;
  return `${code.slice(0, 3)} ${code.slice(3, 6)} ${code.slice(6)}`;
}

/** How many digits a meeting ID has. */
const MEETING_CODE_LENGTH = 10;

/** What someone typing an ID has so far: digits, perhaps with spaces or dashes between. */
const TYPED_ID = /^[\d\s-]*$/;

/** A Japanese keyboard's full-width digits, space and hyphen, as their ASCII ones. */
function halfWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
    )
    .replace(/　/g, " ")
    .replace(/－/g, "-");
}

/** Where the caret goes to sit just after the `count`th digit of `text`. */
function caretAfterDigits(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (/\d/.test(text.charAt(index))) {
      seen += 1;
      if (seen === count) return index + 1;
    }
  }
  return text.length;
}

/**
 * What the Join field shows as someone types or pastes into it: an ID's digits grouped
 * 3 3 4, as the placeholder shows them, with the caret after the same digit as before.
 * Anything with letters in it (a link, an invitation) is left exactly as typed.
 *
 * `previous` is the field's value before this edit, and `inputType` the input event's.
 * Deleting a space on its own deletes the digit beside it instead (before it for
 * Backspace, after it for Delete), so the caret never sticks at a space. Digits typed
 * past an ID's length are dropped, but a longer number already in the field (a mistyped
 * link's, say) is left as digits for the person to shorten.
 */
export function formatTypedMeetingId(
  value: string,
  caret: number | null,
  previous?: string,
  inputType?: string,
): { value: string; caret: number | null } {
  let text = halfWidth(value);
  if (!TYPED_ID.test(text)) return { value, caret };
  let at = caret;

  if (
    previous !== undefined &&
    TYPED_ID.test(previous) &&
    text.length === previous.length - 1
  ) {
    let removed = 0;
    while (removed < text.length && text[removed] === previous[removed]) {
      removed += 1;
    }
    const separator =
      /[\s-]/.test(previous.charAt(removed)) &&
      previous.slice(removed + 1) === text.slice(removed);
    // Without an input type to go by, it was most likely Backspace.
    const backward =
      inputType === undefined || inputType === "deleteContentBackward";
    if (
      separator &&
      inputType === "deleteContentForward" &&
      /\d/.test(text.charAt(removed))
    ) {
      text = text.slice(0, removed) + text.slice(removed + 1);
      at = removed;
    } else if (
      separator &&
      backward &&
      removed > 0 &&
      /\d/.test(text.charAt(removed - 1))
    ) {
      text = text.slice(0, removed - 1) + text.slice(removed);
      at = removed - 1;
    }
  }

  let digits = text.replace(/\D/g, "");
  let before =
    at === null ? digits.length : text.slice(0, at).replace(/\D/g, "").length;
  if (digits.length > MEETING_CODE_LENGTH) {
    const had = (previous ?? "").replace(/\D/g, "").length;
    if (had > MEETING_CODE_LENGTH) {
      return { value: digits, caret: at === null ? null : before };
    }
    // The digits that went past an ID's length, just before the caret, don't fit.
    const extra = digits.length - MEETING_CODE_LENGTH;
    const keep = Math.max(before - extra, 0);
    digits = digits.slice(0, keep) + digits.slice(keep + extra);
    before = keep;
  }

  const grouped = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)]
    .filter(Boolean)
    .join(" ");
  return {
    value: grouped,
    caret: at === null ? null : caretAfterDigits(grouped, before),
  };
}

/** Why what someone entered in the Join field isn't a meeting to open. */
export type MeetingInputProblem =
  /** Only digits, but not the 10 a meeting ID has. */
  | "digits"
  /** Neither a meeting ID nor a link. */
  | "notAnId"
  /** A link to another site: another meeting app, or another copy of this one. */
  | "otherSite"
  /** A link to this site that isn't a meeting's. */
  | "notMeetingLink"
  /** A meeting link whose ID is cut short or mangled. */
  | "brokenLink"
  /** Ten digits no meeting can have: IDs never start with 0. */
  | "notFound";

export type MeetingInput =
  | { ok: true; code: string; passcode?: string }
  | { ok: false; problem: MeetingInputProblem };

const problem = (reason: MeetingInputProblem): MeetingInput => ({
  ok: false,
  problem: reason,
});

/** An ID written the way people do: grouped 3-3-4 with spaces, dashes or dots, or not. */
const WRITTEN_ID = /(?<!\d)\d{3}[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;

/**
 * Reads a meeting from what someone typed or pasted into the Join field: an ID ("123 456
 * 7890", "123-456-7890"), a meeting link (https://example.com/j/1234567890#pwd=K7XQ2M,
 * the passcode riding in the fragment), or a pasted invitation with either in it.
 *
 * `hosts` are this site's hosts ("example.com", "localhost:3000"). A link anywhere else
 * belongs to another site, even with a meeting-like path: its ID means nothing here.
 */
export function readMeetingInput(
  input: string,
  hosts: readonly string[],
): MeetingInput {
  const text = input.trim();
  const compact = text.replace(/[\s().-]/g, "");
  if (/^\d+$/.test(compact)) return readId(compact);

  const link = findLink(text);
  if (link) return readLink(link, hosts);

  // Pasted text around one ID, such as an invitation's "Meeting ID: 123 456 7890".
  const ids = new Set(
    [...text.matchAll(WRITTEN_ID)].map((match) => match[0].replace(/\D/g, "")),
  );
  const [only] = ids;
  return ids.size === 1 && only ? readId(only) : problem("notAnId");
}

function readId(digits: string): MeetingInput {
  if (digits.length !== 10) return problem("digits");
  return MEETING_CODE_PATTERN.test(digits)
    ? { ok: true, code: digits }
    : problem("notFound");
}

/** The first link in the text: with its scheme, or a bare "example.com/j/…". */
function findLink(text: string): URL | null {
  const written =
    /https?:\/\/\S+/i.exec(text)?.[0] ??
    (/^[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}(?::\d+)?(?:\/\S*)?$/i.test(text) ||
    /^localhost:\d+(?:\/\S*)?$/i.test(text)
      ? `https://${text}`
      : null);
  if (!written) return null;
  // A link at the end of a sentence keeps its punctuation; drop it.
  const cleaned = written.replace(/[)\]>.,;:!?'"]+$/, "");
  return URL.canParse(cleaned) ? new URL(cleaned) : null;
}

function readLink(link: URL, hosts: readonly string[]): MeetingInput {
  if (!hosts.includes(link.host)) return problem("otherSite");
  const id = /^\/j\/([^/]*)\/?$/.exec(link.pathname)?.[1];
  if (id === undefined) return problem("notMeetingLink");
  if (!MEETING_CODE_PATTERN.test(id)) return problem("brokenLink");
  const passcode =
    new RegExp(`(?:^#|&)pwd=([${PASSCODE_CHARS}]+)`).exec(link.hash)?.[1] ??
    new RegExp(`^[${PASSCODE_CHARS}]+$`).exec(
      link.searchParams.get("pwd") ?? "",
    )?.[0];
  return passcode ? { ok: true, code: id, passcode } : { ok: true, code: id };
}
