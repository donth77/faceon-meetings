/**
 * The desktop app's mute shortcut, in Electron's words ("CommandOrControl+Shift+A"):
 * checked the same way by Settings → Desktop app and by the app (desktop/src/main).
 */
export type ShortcutPlatform = "mac" | "windows" | "linux";

const KEY = /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space)$/;
const MODIFIERS = new Set([
  "CommandOrControl",
  "CmdOrCtrl",
  "Command",
  "Cmd",
  "Control",
  "Ctrl",
  "Alt",
  "Option",
  "Shift",
  "Super",
]);

/**
 * One to three modifiers, at least one of them not Shift (so the shortcut never takes
 * ordinary typing from other apps), then a letter, a digit, F1–F24 or Space.
 */
export function isAccelerator(value: string): boolean {
  const parts = value.split("+");
  const key = parts.pop() ?? "";
  if (!KEY.test(key) || parts.length < 1 || parts.length > 3) return false;
  if (new Set(parts).size !== parts.length) return false;
  return (
    parts.every((part) => MODIFIERS.has(part)) &&
    parts.some((part) => part !== "Shift")
  );
}

type KeyPress = {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

/** The shortcut a key press makes, or null where it can't be one (see isAccelerator). */
export function acceleratorFromKey(
  press: KeyPress,
  platform: ShortcutPlatform,
): string | null {
  const key =
    /^Key([A-Z])$/.exec(press.code)?.[1] ??
    /^Digit(\d)$/.exec(press.code)?.[1] ??
    (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(press.code) ? press.code : null) ??
    (press.code === "Space" ? "Space" : null);
  if (!key) return null;
  const modifiers: string[] = [];
  if (platform === "mac" ? press.metaKey : press.ctrlKey) {
    modifiers.push("CommandOrControl");
  }
  if (platform === "mac" && press.ctrlKey) modifiers.push("Control");
  if (platform !== "mac" && press.metaKey) modifiers.push("Super");
  if (press.altKey) modifiers.push("Alt");
  if (press.shiftKey) modifiers.push("Shift");
  const accelerator = [...modifiers, key].join("+");
  return isAccelerator(accelerator) ? accelerator : null;
}

const MAC: Record<string, [number, string]> = {
  Control: [0, "⌃"],
  Ctrl: [0, "⌃"],
  Alt: [1, "⌥"],
  Option: [1, "⌥"],
  Shift: [2, "⇧"],
  CommandOrControl: [3, "⌘"],
  CmdOrCtrl: [3, "⌘"],
  Command: [3, "⌘"],
  Cmd: [3, "⌘"],
  Super: [3, "⌘"],
};
const OTHERS: Record<string, string> = {
  CommandOrControl: "Ctrl",
  CmdOrCtrl: "Ctrl",
  Control: "Ctrl",
  Ctrl: "Ctrl",
  Command: "Win",
  Cmd: "Win",
  Super: "Win",
  Alt: "Alt",
  Option: "Alt",
  Shift: "Shift",
};

/** How a shortcut reads: ⇧⌘A on a Mac, Ctrl+Shift+A elsewhere. */
export function formatAccelerator(
  value: string,
  platform: ShortcutPlatform,
): string {
  const parts = value.split("+");
  const key = parts.pop() ?? "";
  if (platform === "mac") {
    const symbols = parts
      .map((part): [number, string] => MAC[part] ?? [9, part])
      .sort((a, b) => a[0] - b[0])
      .map(([, symbol]) => symbol);
    return [...symbols, key].join("");
  }
  return [...parts.map((part) => OTHERS[part] ?? part), key].join("+");
}
