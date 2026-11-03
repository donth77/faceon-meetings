# FaceOn for Google Workspace

A Google Workspace add-on for Google Calendar and Gmail, in the spirit of Zoom for Google
Workspace:

- **FaceOn meeting** in Calendar's **Add video conferencing** menu.
- A FaceOn sidebar in Calendar and Gmail.
- **Insert a FaceOn meeting** in Gmail's compose window.

It's an Apps Script add-on (Google documents conferencing add-ons only for Apps Script),
written in TypeScript and bundled with esbuild. Nobody publishes it: each person adds their
own copy to their Google account from FaceOn's Settings → Calendar, FaceOn writes it there
through the Apps Script API and keeps it up to date, and they install it with one click in
Google's Apps Script editor. It's a thin client: every action is one call to FaceOn's API
(`/api/addon/google/*`) with the person's Google identity token, and it keeps no data of
its own.

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
| `src/config.ts`                               | The copy's own settings, from the first line of its `Code.js`               |
| `appsscript.json`                             | The manifest template, filled in for each FaceOn                            |
| `build.mjs`                                   | The bundle FaceOn writes into people's accounts, or a developer's `dist/`   |

The API's request and response types are shared with FaceOn's server
(`src/lib/addon/google/types.ts`), which makes and updates people's copies
(`src/lib/addon/google/setup.ts`).

## Build and push

```sh
node google-addon/build.mjs --bundle   # what FaceOn writes into people's accounts (dev, build, test and typecheck run it)
pnpm addon:build                       # dist/, a developer's build for FACEON_URL (https://joinfaceon.app by default)
pnpm addon:push                        # builds, then pushes dist/ to the Apps Script project in .clasp.json
```

A developer's build reads `FACEON_URL`, `NEXT_PUBLIC_APP_NAME`,
`GOOGLE_ADDON_CONFERENCE_LOGO_URL` and `FACEON_CONNECT_TOKEN`. Calendar shows a conference
logo only from Google's own servers ([SETUP.md](SETUP.md#your-own-logo-in-calendar)).
`pnpm brand` writes the add-on's icons and banner to `assets/`.

Working on it, and trying your changes on your own copy, is in [SETUP.md](SETUP.md). The
checklist before a change goes out is [QA.md](QA.md).
