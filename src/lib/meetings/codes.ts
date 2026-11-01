/** Meeting IDs are 10 random digits that never start with 0, shown as "123 456 7890". */
export const MEETING_CODE_PATTERN = /^[1-9]\d{9}$/;

/** Formats a meeting ID for display: "1234567890" → "123 456 7890". Anything else is returned unchanged. */
export function formatMeetingCode(code: string): string {
  if (!MEETING_CODE_PATTERN.test(code)) return code;
  return `${code.slice(0, 3)} ${code.slice(3, 6)} ${code.slice(6)}`;
}

export type ParsedMeetingInput = { code: string; passcode?: string };

/**
 * Reads a meeting ID from what someone typed or pasted into the Join field:
 * "123 456 7890", "123-456-7890", or an invite link such as
 * https://example.com/j/1234567890#pwd=K7XQ2M (the passcode rides in the fragment).
 * Returns null when there's no valid meeting ID.
 */
export function parseMeetingInput(input: string): ParsedMeetingInput | null {
  const text = input.trim();
  if (!text) return null;

  const linkCode = /\/j\/([1-9]\d{9})(?!\d)/.exec(text)?.[1];
  if (linkCode) {
    const passcode = /[#&]pwd=([A-Za-z0-9]+)/.exec(text)?.[1];
    return passcode ? { code: linkCode, passcode } : { code: linkCode };
  }

  const digits = text.replace(/[\s-]/g, "");
  return MEETING_CODE_PATTERN.test(digits) ? { code: digits } : null;
}
