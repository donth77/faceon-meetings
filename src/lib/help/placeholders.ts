/**
 * Help articles name things this copy sets: {appName}, and its meeting limits. Pure, so
 * a test can check every article fills completely.
 */

export type HelpLimits = {
  demoMinutes: number;
  demoPeople: number;
  demoPerDay: number;
  fullPeople: number;
  /** 0: no time limit. */
  fullMinutes: number;
  meetingsPerDay: number;
  /** 0: nobody is asked whether they're still there. */
  aloneMinutes: number;
};

/** The sentences some placeholders become, in the article's language (messages: Help.fill). */
export type HelpPhrase =
  "fullLengthLimited" | "fullLengthUnlimited" | "aloneCheck" | "aloneCheckOff";
export type HelpPhrases = (
  phrase: HelpPhrase,
  values: { appName: string; minutes?: number },
) => string;

export function fillHelpPlaceholders(
  raw: string,
  values: { appName: string } & HelpLimits,
  phrases: HelpPhrases,
): string {
  const { appName } = values;
  const fullLength =
    values.fullMinutes > 0
      ? phrases("fullLengthLimited", { appName, minutes: values.fullMinutes })
      : phrases("fullLengthUnlimited", { appName });
  const aloneCheck =
    values.aloneMinutes > 0
      ? phrases("aloneCheck", { appName, minutes: values.aloneMinutes })
      : phrases("aloneCheckOff", { appName });
  return raw
    .replaceAll("{appName}", appName)
    .replaceAll("{demoMinutes}", String(values.demoMinutes))
    .replaceAll("{demoPeople}", String(values.demoPeople))
    .replaceAll("{demoPerDay}", String(values.demoPerDay))
    .replaceAll("{fullPeople}", String(values.fullPeople))
    .replaceAll("{fullLength}", fullLength)
    .replaceAll("{meetingsPerDay}", String(values.meetingsPerDay))
    .replaceAll("{aloneCheck}", aloneCheck);
}
