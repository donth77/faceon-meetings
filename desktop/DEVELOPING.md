# Working on the desktop app

The desktop app is a thin shell around the hosted web app: one window that loads it, plus
what a browser tab can't do. That means opening `faceon://` meeting links, living in the
tray or menu bar, a mute shortcut that works from any app, a native screen-share picker,
meeting reminders and an unread badge while no browser is open, and updates. Everything
inside the window is the web app itself, so the app never falls behind it. Linux comes
after 1.0; the code stays portable for it.

It's [Electron](https://www.electronjs.org/) in this folder, a pnpm workspace package
(`@faceon/desktop`). Building installers, signing them and publishing releases is in
[RELEASING.md](RELEASING.md).

## Run it while you work

```bash
pnpm dev            # the web app, in one terminal
pnpm desktop:dev    # the app, opening http://localhost:3000
```

The first run downloads Electron for your computer (web installs and Vercel never do).
`FACEON_APP_URL=https://… pnpm desktop:dev` points it at another copy of the site.

## Try the real app

```bash
pnpm desktop:try
```

This builds the app unpacked (no installer, so no signing and no trouble with long folder
paths) and opens it. Unlike `pnpm desktop:dev`, it's named and pictured as FaceOn in the
title bar, the taskbar or Dock, and the tray or menu bar, and browsers ask "Open FaceOn?"
for meeting links and sign-in, not "Open Electron?".

- It opens `https://joinfaceon.app` unless `FACEON_APP_URL` says otherwise.
- It takes over `faceon://` links on this computer until another copy (an installed one,
  say) takes them back.
- On Windows, notifications show only from apps Windows knows: for an installed copy,
  that's the installer's Start menu shortcut. `pnpm desktop:try` and `pnpm desktop:dev`
  register theirs for you only (`scripts/app-id.mjs`, under
  `HKCU\Software\Classes\AppUserModelId`), so reminders show as FaceOn there too.

## Signing in

Google refuses sign-in inside embedded browsers, so **Continue with Google** and **Continue
with GitHub** go through the system browser:

1. The app opens the site's `/desktop/sign-in` in the browser, with a one-time challenge.
2. The person signs in there, and the browser hands back a `faceon://auth` link with a
   one-time token.
3. The app exchanges that token, together with a verifier only it has, for the window's
   own session. Both travel in a header, never in a URL.

The app's side is `src/main/sign-in.ts`; the site's is `src/lib/auth/desktop-handoff.ts`
and `src/lib/desktop/handoff.ts`. Email and password work in the window itself.

## Tests

- `pnpm test` runs the shell's unit tests with the rest (`tests/*.test.ts`): links, the
  origin and permission rules, settings checks, sign-in's state and verifier, and
  reminders.
- `pnpm --filter @faceon/desktop test:e2e` runs Electron with its windows hidden against
  a stand-in site, and checks the window, the bridge, links, navigation, permissions and
  the mute shortcut.
- [QA.md](QA.md) is the checklist for each release, by hand on a Mac and a Windows PC.

## How it's built

- `src/main/`: the main process. `window.ts` (the one window, its size and place kept),
  `security.ts` and `policy.ts` (only the app's origin in the window; other sites open in
  the browser; a meeting's permissions only), `links.ts` (`faceon://`), `ipc.ts` and
  `schemas.ts` (the bridge, every call checked with Zod), `sign-in.ts` (Google and
  GitHub through the system browser), `tray.ts`, `shortcut.ts`, `share-picker.ts`,
  `reminders.ts`, `badge.ts`, `updates.ts` and `store.ts` (Settings → Desktop app, in
  `userData/state.json`).
- `src/preload/`: `window.faceonDesktop`, only on the app's origin, and the share
  picker's own small bridge. Windows are sandboxed, with context isolation and no Node.
- The bridge's contract is the web app's `src/lib/desktop/bridge.ts`, imported for types
  only, so the two can't drift.
- Electron's fuses turn off running as Node and Node options, and load the app only from
  its checked archive.
