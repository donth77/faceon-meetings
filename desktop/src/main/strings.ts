/**
 * The shell's own words: its menus, tray, notifications and dialogs, in the app's
 * language (language.ts picks it). Everything inside the window is the web app, whose
 * words come from its message files. Menu names mark their Windows access key with &,
 * as each language does it ("&File", "ファイル(&F)").
 */
const en = {
  about: (name: string) => `About ${name}`,
  checkForUpdates: "Check for Updates…",
  settings: "Settings…",
  help: "Help",
  quit: (name: string) => `Quit ${name}`,
  hide: (name: string) => `Hide ${name}`,
  hideOthers: "Hide Others",
  showAll: "Show All",
  services: "Services",
  fileMenu: "&File",
  editMenu: "&Edit",
  viewMenu: "&View",
  windowMenu: "&Window",
  helpMenu: "&Help",
  undo: "Undo",
  redo: "Redo",
  cut: "Cut",
  copy: "Copy",
  paste: "Paste",
  pasteAndMatchStyle: "Paste and Match Style",
  delete: "Delete",
  selectAll: "Select All",
  reload: "Reload",
  actualSize: "Actual Size",
  zoomIn: "Zoom In",
  zoomOut: "Zoom Out",
  fullScreen: "Toggle Full Screen",
  minimize: "Minimize",
  zoom: "Zoom",
  close: "Close",
  bringAllToFront: "Bring All to Front",
  open: (name: string) => `Open ${name}`,
  startMeeting: "Start a meeting",
  joinMeeting: "Join a meeting…",
  upcoming: "Upcoming",
  joinNext: (title: string) => `Join “${title}”`,
  mute: "Mute",
  unmute: "Unmute",
  leave: "Leave meeting",
  join: "Join",
  startsIn: (minutes: number) =>
    minutes === 1 ? "Starts in 1 minute" : `Starts in ${minutes} minutes`,
  unread: (count: number) =>
    count === 1 ? "1 unread message" : `${count} unread messages`,
  updateReady: (name: string, version: string) =>
    `${name} ${version} is ready to install`,
  updateReadyDetail: "Restart to finish updating.",
  restartNow: "Restart now",
  later: "Later",
  upToDate: (name: string) => `${name} is up to date`,
  updatesOff: "Updates aren’t set up for this build.",
  updateFailed: "Couldn’t check for updates. Try again later.",
  newVersion: (name: string, version: string) => `${name} ${version} is out`,
  download: "Download",
  ok: "OK",
};

/** Every string the shell shows. Each language has all of them; TypeScript checks it. */
export type Strings = typeof en;

/** The languages the shell speaks, named as the web app names them. */
export const translations: Record<string, Strings> = { en };

/** The shell's words in its current language; setLanguage switches them. */
export const strings: Strings = { ...en };

let current = "en";

/**
 * The language for the first of these tags the shell speaks: the same tag, or else one
 * in the same base language ("pt-PT" → "pt-BR"); English when none matches.
 */
export function languageFor(
  tags: readonly (string | null | undefined)[],
): string {
  const languages = Object.keys(translations);
  for (const tag of tags) {
    if (!tag) continue;
    const wanted = tag.replace("_", "-").toLowerCase();
    const exact = languages.find(
      (language) => language.toLowerCase() === wanted,
    );
    if (exact) return exact;
    const base = wanted.split("-")[0];
    const sameLanguage = languages.find(
      (language) => language.split("-")[0]?.toLowerCase() === base,
    );
    if (sameLanguage) return sameLanguage;
  }
  return "en";
}

/** Switches the shell's words to a language it speaks; true when that changed them. */
export function setLanguage(language: string): boolean {
  const next = translations[language];
  if (!next || language === current) return false;
  Object.assign(strings, next);
  current = language;
  return true;
}

/** A menu name without its Windows access key, for macOS: "&File" → "File". */
export function withoutAccessKey(label: string): string {
  return label.replace(/\s*\(&.\)$/, "").replace(/&(.)/, "$1");
}
