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

|                                               |                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `src/main.ts`, `src/handlers.ts`              | Every handler Google calls; the build makes each a global function          |
| `src/conference.ts`, `src/conference-plan.ts` | **FaceOn meeting** in Calendar: the conference data, or Google's error      |
| `src/sync.ts`, `src/calendar-events.ts`       | The Calendar trigger that keeps FaceOn's meetings in step with their events |
| `src/home.ts`, `src/compose.ts`               | The sidebar, and Gmail's **Insert a FaceOn meeting**                        |
| `src/cards.ts`, `src/render.ts`               | The cards as plain values (tested), and as CardService cards                |
| `src/api.ts`, `src/api-errors.ts`             | Calls to FaceOn's API, with the person's Google identity token              |
| `src/settings.ts`                             | Calendar's settings link to FaceOn's Settings → Calendar                    |
| `src/text.ts`, `src/i18n.ts`                  | Card text from `messages/<language>.json` (`GoogleAddon`)                   |
| `appsscript.json`                             | The manifest, filled in by the build for your copy                          |
| `build.mjs`                                   | Builds `dist/Code.js` and `dist/appsscript.json`                            |

The API's request and response types are shared with FaceOn's server
(`src/lib/addon/google/types.ts`).

## Build and push

```sh
pnpm addon:build   # dist/, for the copy at FACEON_URL (https://joinfaceon.app by default)
pnpm addon:push    # builds, then pushes dist/ to the Apps Script project in .clasp.json
```

Settings for the build (environment variables): `FACEON_URL`, `NEXT_PUBLIC_APP_NAME`,
`FACEON_ADDON_LOGO_URL` and `FACEON_CONFERENCE_LOGO_URL`. Calendar takes the conference
logo only from the Marketplace listing's 32 × 32 icon ([SPIKE.md](SPIKE.md), section 3).
`pnpm brand` writes the listing's icons and banner to `assets/`.

Setting it up the first time, and what to check then, is in [SPIKE.md](SPIKE.md).
The checklist for each release is [QA.md](QA.md).
