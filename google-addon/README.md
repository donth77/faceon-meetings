# FaceOn for Google Workspace

A Google Workspace add-on for Google Calendar and Gmail, in the spirit of Zoom for Google
Workspace:

- **FaceOn meeting** in Calendar's **Add video conferencing** menu.
- A FaceOn sidebar in Calendar and Gmail.
- **Insert a FaceOn meeting** in Gmail's compose window.

It's an Apps Script add-on (Google documents conferencing add-ons only for Apps Script),
written in TypeScript, bundled with esbuild and pushed with [clasp](https://github.com/google/clasp).
It's a thin client: every action is one call to FaceOn's API (`/api/addon/google/*`)
with the person's Google identity token, and it keeps no data of its own.

|                              |                                                           |
| ---------------------------- | --------------------------------------------------------- |
| `src/main.ts`                | Every handler Google calls (listed in `src/handlers.ts`)  |
| `src/conference.ts`          | **FaceOn meeting** in Calendar                            |
| `src/home.ts`                | The sidebar's homepage                                    |
| `src/settings.ts`            | Calendar's settings link to FaceOn's Settings             |
| `src/text.ts`, `src/i18n.ts` | Card text from `messages/<language>.json` (`GoogleAddon`) |
| `appsscript.json`            | The manifest, filled in by the build for your copy        |
| `build.mjs`                  | Builds `dist/Code.js` and `dist/appsscript.json`          |

## Build and push

```sh
pnpm addon:build   # dist/, for the copy at FACEON_URL (https://joinfaceon.app by default)
pnpm addon:push    # builds, then pushes dist/ to the Apps Script project in .clasp.json
```

Settings for the build (environment variables): `FACEON_URL`, `NEXT_PUBLIC_APP_NAME`,
`FACEON_ADDON_LOGO_URL` and `FACEON_CONFERENCE_LOGO_URL` (Google asks for a conference
logo it hosts).

Setting up a test deployment for the first time is in [SPIKE.md](SPIKE.md).
