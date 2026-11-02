/**
 * FaceOn's keyboard shortcuts, as listed in the Keyboard shortcuts dialog and in
 * Settings → Accessibility.
 */

export type ShortcutId =
  "mute" | "talk" | "video" | "share" | "sidebar" | "shortcuts";

export type ShortcutGroupId = "meeting" | "anywhere";

/** Keys per platform; each inner list is one combination ("Ctrl" + "D"). */
type Combos = { other: string[][]; apple: string[][] };

/** Every shortcut that works today, in both the Meet and the Zoom style. */
const GROUPS: Array<{
  id: ShortcutGroupId;
  shortcuts: Array<{ id: ShortcutId; keys: Combos }>;
}> = [
  {
    id: "meeting",
    shortcuts: [
      {
        id: "mute",
        keys: {
          other: [
            ["Ctrl", "D"],
            ["Alt", "A"],
          ],
          apple: [
            ["⌘", "D"],
            ["⌥", "A"],
          ],
        },
      },
      { id: "talk", keys: { other: [["Space"]], apple: [["Space"]] } },
      {
        id: "video",
        keys: {
          other: [
            ["Ctrl", "E"],
            ["Alt", "V"],
          ],
          apple: [
            ["⌘", "E"],
            ["⌥", "V"],
          ],
        },
      },
      { id: "share", keys: { other: [["Alt", "S"]], apple: [["⌥", "S"]] } },
    ],
  },
  {
    id: "anywhere",
    shortcuts: [
      { id: "sidebar", keys: { other: [["Ctrl", "B"]], apple: [["⌘", "B"]] } },
      {
        id: "shortcuts",
        keys: { other: [["?"], ["Ctrl", "/"]], apple: [["?"], ["⌘", "/"]] },
      },
    ],
  },
];

export type ShortcutGroup = {
  id: ShortcutGroupId;
  shortcuts: Array<{ id: ShortcutId; combos: string[][] }>;
};

/**
 * The shortcuts as they work for this person: their platform's keys, only combinations
 * without single-key shortcuts (Settings → Accessibility), and Space to talk only with
 * Push to talk on (Settings → Audio).
 */
export function shortcutsFor(options: {
  apple: boolean;
  singleKeys: boolean;
  pushToTalk: boolean;
}): ShortcutGroup[] {
  return GROUPS.map((group) => ({
    id: group.id,
    shortcuts: group.shortcuts
      .filter((shortcut) => shortcut.id !== "talk" || options.pushToTalk)
      .map((shortcut) => ({
        id: shortcut.id,
        combos: (options.apple
          ? shortcut.keys.apple
          : shortcut.keys.other
        ).filter((combo) => options.singleKeys || combo.length > 1),
      }))
      .filter((shortcut) => shortcut.combos.length > 0),
  }));
}
