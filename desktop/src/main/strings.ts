/**
 * The shell's own words: its menus, tray, notifications and dialogs. Everything inside
 * the window is the web app, whose words come from its message files.
 */
export const strings = {
  about: (name: string) => `About ${name}`,
  checkForUpdates: "Check for Updates…",
  settings: "Settings…",
  help: "Help",
  quit: (name: string) => `Quit ${name}`,
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
} as const;
