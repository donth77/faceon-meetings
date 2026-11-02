"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react";

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isAppleDevice, isTypingTarget } from "@/lib/platform";
import { loadPreferences, withDefaults } from "@/lib/preferences";

type ShortcutId = "mute" | "talk" | "video" | "share" | "sidebar" | "shortcuts";

/** Keys per platform; each inner list is one combination ("Ctrl" + "D"). */
type Combos = { other: string[][]; apple: string[][] };

/** Every shortcut that works today, in both the Meet and the Zoom style. */
const GROUPS: Array<{
  id: "meeting" | "anywhere";
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

function Keys({ combos }: { combos: string[][] }) {
  const t = useTranslations("Shortcuts");
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      {combos.map((combo, index) => (
        <span key={combo.join("+")} className="flex items-center gap-1">
          {index > 0 ? (
            <span className="text-muted-foreground px-1 text-xs">
              {t("or")}
            </span>
          ) : null}
          {combo.map((key) => (
            <kbd
              key={key}
              className="bg-muted text-foreground min-w-6 rounded-md border px-1.5 py-0.5 text-center font-sans text-xs font-semibold"
            >
              {key}
            </kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

/**
 * Without single-key shortcuts (Settings → Accessibility), only combinations are listed;
 * Space to talk only with Push to talk on (Settings → Audio).
 */
function shortcutsFor(
  apple: boolean,
  singleKeys: boolean,
  pushToTalk: boolean,
) {
  return GROUPS.map((group) => ({
    id: group.id,
    shortcuts: group.shortcuts
      .filter((shortcut) => shortcut.id !== "talk" || pushToTalk)
      .map((shortcut) => ({
        id: shortcut.id,
        combos: (apple ? shortcut.keys.apple : shortcut.keys.other).filter(
          (combo) => singleKeys || combo.length > 1,
        ),
      }))
      .filter((shortcut) => shortcut.combos.length > 0),
  }));
}

const OpenShortcutsContext = createContext<() => void>(() => {});

/** Opens the Keyboard shortcuts dialog (from Help, the account menu, a meeting's menus). */
export const useOpenShortcuts = () => use(OpenShortcutsContext);

/**
 * The Keyboard shortcuts dialog, available everywhere: ? or Ctrl/⌘+/ opens it, as in
 * Gmail, Meet and GitHub. Keys show for the person's platform.
 */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("Shortcuts");
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState(() => shortcutsFor(false, true, false));

  function show() {
    const { singleKeyShortcuts, pushToTalk } = withDefaults(loadPreferences());
    setGroups(shortcutsFor(isAppleDevice(), singleKeyShortcuts, pushToTalk));
    setOpen(true);
  }
  const showOnKey = useEffectEvent(show);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || isTypingTarget(event.target)) return;
      const primary = isAppleDevice() ? event.metaKey : event.ctrlKey;
      const question =
        event.key === "?" &&
        !primary &&
        !event.altKey &&
        withDefaults(loadPreferences()).singleKeyShortcuts;
      if (question || (primary && event.key === "/")) {
        event.preventDefault();
        showOnKey();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <OpenShortcutsContext value={show}>
      {children}
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        className="sm:max-w-lg"
        closeLabel={t("close")}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`shortcuts-${group.id}`}>
            <h3
              id={`shortcuts-${group.id}`}
              className="text-muted-foreground mb-2 text-xs font-bold tracking-[0.06em] uppercase"
            >
              {t(`groups.${group.id}`)}
            </h3>
            <dl className="divide-y">
              {group.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.id}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <dt className="text-sm">{t(`actions.${shortcut.id}`)}</dt>
                  <dd>
                    <Keys combos={shortcut.combos} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </Dialog>
    </OpenShortcutsContext>
  );
}
