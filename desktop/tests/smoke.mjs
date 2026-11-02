// End-to-end check of the desktop shell (pnpm --filter @faceon/desktop test:e2e):
// Electron runs a development build, with its windows hidden, against a stand-in for
// the site on localhost. It checks the window, the bridge and where it exists, faceon://
// links, navigation and permission rules, settings checks and the mute shortcut.
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join } from "node:path";
import { _electron as electron } from "@playwright/test";

import { desktopDir } from "../scripts/env.mjs";

const PORT = 3999;
const ORIGIN = `http://localhost:${PORT}`;
const require = createRequire(import.meta.url);

const server = createServer((request, response) => {
  if (request.url?.startsWith("/api/desktop/upcoming")) {
    response.writeHead(401).end();
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(
    `<!doctype html><title>${request.url}</title><p>${request.url}</p>`,
  );
});
await new Promise((resolve) => server.listen(PORT, "localhost", resolve));

const built = spawnSync(
  process.execPath,
  [join(desktopDir, "scripts/build.mjs"), "--dev"],
  {
    env: { ...process.env, FACEON_APP_URL: ORIGIN },
    stdio: "inherit",
  },
);
if (built.status !== 0) process.exit(1);

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`,
  );
  if (!ok) failures++;
};

const app = await electron.launch({
  executablePath: require("electron"),
  args: [desktopDir],
  env: { ...process.env, FACEON_APP_URL: ORIGIN, FACEON_HIDDEN: "1" },
});
try {
  const page = await app.firstWindow();
  await page.waitForURL(`${ORIGIN}/home`, { timeout: 30_000 });
  check("the window opens the site's Home", page.url() === `${ORIGIN}/home`);

  const bridge = await page.evaluate(() => ({
    bridge: window.faceonDesktop?.bridge,
    platform: window.faceonDesktop?.platform,
    keys: Object.keys(window.faceonDesktop ?? {}).sort(),
  }));
  check(
    "the bridge is there on the app's origin",
    bridge.bridge === 1,
    JSON.stringify(bridge),
  );

  // A faceon:// meeting link opens the join page, passcode and all.
  await app.evaluate(({ app: electronApp }) => {
    electronApp.emit(
      "open-url",
      { preventDefault() {} },
      "faceon://j/1234567890#pwd=K7XQ2M",
    );
  });
  await page.waitForURL(`${ORIGIN}/j/1234567890#pwd=K7XQ2M`, {
    timeout: 10_000,
  });
  check(
    "faceon://j/<id> opens the meeting",
    page.url().endsWith("/j/1234567890#pwd=K7XQ2M"),
  );

  // A link that isn't the app's does nothing.
  await app.evaluate(({ app: electronApp }) => {
    electronApp.emit(
      "open-url",
      { preventDefault() {} },
      "faceon://evil.example/steal",
    );
  });
  await page.waitForTimeout(500);
  check(
    "other faceon:// links are ignored",
    page.url().endsWith("/j/1234567890#pwd=K7XQ2M"),
  );

  // Other origins open outside (captured here, not in a real browser); other schemes do nothing.
  await app.evaluate(({ shell }) => {
    globalThis.opened = [];
    shell.openExternal = async (url) => {
      globalThis.opened.push(url);
    };
  });
  await page.evaluate(() => {
    window.location.href = "https://example.com/elsewhere";
  });
  await page.waitForTimeout(800);
  const opened = await app.evaluate(() => globalThis.opened);
  check(
    "other sites open in the browser, not the window",
    page.url().startsWith(ORIGIN) &&
      opened.includes("https://example.com/elsewhere"),
    JSON.stringify(opened),
  );
  await page.evaluate(() => {
    window.location.href = "file:///C:/Windows/win.ini";
  });
  await page.waitForTimeout(500);
  check("file:// and other schemes are refused", page.url().startsWith(ORIGIN));

  // Permissions: a meeting's only.
  const permissions = await page.evaluate(async () => ({
    geolocation: (await navigator.permissions.query({ name: "geolocation" }))
      .state,
    notifications: (
      await navigator.permissions.query({ name: "notifications" })
    ).state,
  }));
  check(
    "location is denied",
    permissions.geolocation === "denied",
    JSON.stringify(permissions),
  );
  check("notifications are granted", permissions.notifications === "granted");

  // Settings are checked in the main process.
  const settings = await page.evaluate(async () => {
    const refused = await window.faceonDesktop.preferences
      .set({ admin: true })
      .then(
        () => false,
        () => true,
      );
    const changed = await window.faceonDesktop.preferences.set({
      badge: false,
    });
    return { refused, badge: changed.badge };
  });
  check(
    "unknown settings are refused, known ones kept",
    settings.refused && settings.badge === false,
    JSON.stringify(settings),
  );
  await page.evaluate(() =>
    window.faceonDesktop.preferences.set({ badge: true }),
  );

  // The mute shortcut exists only during a meeting.
  const registered = () =>
    app.evaluate(({ globalShortcut }) =>
      globalShortcut.isRegistered("CommandOrControl+Shift+A"),
    );
  await page.evaluate(() =>
    window.faceonDesktop.meeting({ inMeeting: true, muted: false }),
  );
  await page.waitForTimeout(300);
  const during = await registered();
  await page.evaluate(() =>
    window.faceonDesktop.meeting({ inMeeting: false, muted: false }),
  );
  await page.waitForTimeout(300);
  const after = await registered();
  check(
    "the mute shortcut is registered only in a meeting",
    during && !after,
    `during ${during}, after ${after}`,
  );

  // The mute command reaches the page.
  await page.evaluate(() => {
    window.commands = [];
    window.faceonDesktop.onCommand((command) => window.commands.push(command));
  });
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send("faceon:command", {
      type: "toggleMute",
    });
  });
  await page.waitForTimeout(300);
  const commands = await page.evaluate(() => window.commands);
  check(
    "commands reach the page",
    commands.length === 1 && commands[0].type === "toggleMute",
  );

  // No bridge on anything but the app's origin.
  await app.evaluate(({ BrowserWindow }) => {
    void BrowserWindow.getAllWindows()[0]?.loadURL(
      "data:text/html,<p>elsewhere</p>",
    );
  });
  await page.waitForURL(/^data:/, { timeout: 10_000 });
  const elsewhere = await page.evaluate(() => typeof window.faceonDesktop);
  check("no bridge on other origins", elsewhere === "undefined");
} finally {
  await app.close();
  server.close();
}
console.log(`failures: ${failures}`);
process.exit(failures ? 1 : 0);
