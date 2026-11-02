"use client";

import { useTranslations } from "next-intl";
import { useId, useSyncExternalStore } from "react";

import { isAppleDevice } from "@/lib/platform";
import { usePreferences, withDefaults } from "@/lib/preferences";

import { shortcutsFor } from "./shortcuts";

/** The platform doesn't change while the page is open. */
const subscribeNever = () => () => {};

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
 * Every keyboard shortcut as it works here: this platform's keys, following Settings as
 * they change. In the Keyboard shortcuts dialog, and in Settings → Accessibility, whose
 * card heading is a level deeper in the meeting's Settings dialog.
 */
export function ShortcutsList({ headingLevel = 3 }: { headingLevel?: 3 | 4 }) {
  const t = useTranslations("Shortcuts");
  const id = useId();
  const { singleKeyShortcuts, pushToTalk } = withDefaults(usePreferences());
  const apple = useSyncExternalStore(
    subscribeNever,
    isAppleDevice,
    () => false,
  );
  const Heading = headingLevel === 4 ? "h4" : "h3";
  const groups = shortcutsFor({
    apple,
    singleKeys: singleKeyShortcuts,
    pushToTalk,
  });

  return (
    <>
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`${id}-${group.id}`}>
          <Heading
            id={`${id}-${group.id}`}
            className="text-muted-foreground mb-2 text-xs font-bold tracking-[0.06em] uppercase"
          >
            {t(`groups.${group.id}`)}
          </Heading>
          <dl className="divide-y divide-[#e2e5ea] dark:divide-white/10">
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
    </>
  );
}
