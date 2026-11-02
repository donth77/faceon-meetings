import { APP_NAME } from "./config";
import { translator, type Texts, type Translate } from "./text";

/** Set by the build: every language's GoogleAddon messages. */
declare const __TEXTS__: Texts;

/** What every add-on event says about the person (Google's commonEventObject). */
export type AddonEvent = {
  commonEventObject?: {
    userLocale?: string;
    timeZone?: { id?: string };
    formInputs?: Record<string, { stringInputs?: { value?: string[] } }>;
    parameters?: Record<string, string>;
  };
};

/** Card text in the person's language. */
export function textFor(event: AddonEvent | undefined): Translate {
  return translator(__TEXTS__, event?.commonEventObject?.userLocale, APP_NAME);
}
