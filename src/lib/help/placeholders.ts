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

export function fillHelpPlaceholders(
  raw: string,
  values: { appName: string } & HelpLimits,
): string {
  const fullLength =
    values.fullMinutes > 0
      ? `for up to ${values.fullMinutes} minutes`
      : "with no time limit";
  const aloneCheck =
    values.aloneMinutes > 0
      ? `After ${values.aloneMinutes} minutes alone in a meeting, ${values.appName} asks whether you’re still there, and leaves for you if nobody answers.`
      : `${values.appName} doesn’t end a meeting because you’re alone in it.`;
  return raw
    .replaceAll("{appName}", values.appName)
    .replaceAll("{demoMinutes}", String(values.demoMinutes))
    .replaceAll("{demoPeople}", String(values.demoPeople))
    .replaceAll("{demoPerDay}", String(values.demoPerDay))
    .replaceAll("{fullPeople}", String(values.fullPeople))
    .replaceAll("{fullLength}", fullLength)
    .replaceAll("{meetingsPerDay}", String(values.meetingsPerDay))
    .replaceAll("{aloneCheck}", aloneCheck);
}
