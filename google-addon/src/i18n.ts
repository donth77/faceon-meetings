import { APP_NAME } from "./config";
import { translator, type Texts, type Translate } from "./text";

/** Set by the build: every language's GoogleAddon messages. */
declare const __TEXTS__: Texts;

/** What every card event says about the person (Google's commonEventObject). */
export type AddonEvent = {
  commonEventObject?: {
    userLocale?: string;
    timeZone?: { id?: string };
    formInputs?: Record<string, { stringInputs?: { value?: string[] } }>;
    parameters?: Record<string, string>;
  };
};

/** The person's language: from the card event, or their Google account. */
export function localeOf(event?: AddonEvent): string | undefined {
  return event?.commonEventObject?.userLocale ?? Session.getActiveUserLocale();
}

/** Card text in the person's language. */
export function textFor(event?: AddonEvent): Translate {
  return translator(__TEXTS__, localeOf(event), APP_NAME);
}

/** A form field's value in a card action. */
export function inputOf(event: AddonEvent, name: string): string {
  return (
    event.commonEventObject?.formInputs?.[name]?.stringInputs?.value?.[0] ?? ""
  );
}
