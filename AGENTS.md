<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FaceOn: guide for coding agents

FaceOn is a free, open-source (MIT), browser-based video meeting app that should feel instantly familiar to anyone who has used Zoom or Google Meet.

## Commands

| Command                                      | Use                                                        |
| -------------------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                                   | Dev server on http://localhost:3000                        |
| `pnpm build`                                 | Production build (also what Vercel runs)                   |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | ESLint / route types + `tsc` / Vitest; all three run in CI |
| `pnpm format`                                | Prettier (with the Tailwind class-sorting plugin)          |

Node.js 24 and pnpm 10. Deploys happen by pushing to GitHub (Vercel's Git integration), never with `vercel deploy`.

## Architecture map

- `src/app/`: routes (App Router). Metadata files (`icon.svg`, `favicon.ico`, `apple-icon.png`, `opengraph-image.png`) live here.
- `src/lib/`: server and shared logic. `env.ts` validates environment variables with Zod; `meetings/` holds meeting IDs and passcodes.
- `public/brand/`: logo files; `public/icons/`: PWA icons.
- Planned:
  - `src/lib/media/` defines the media-provider interface, with `src/lib/stream/` and `src/lib/livekit/` as its adapters.
  - `src/components/meeting/` holds the meeting UI.

## Conventions

- **TypeScript strict.** Validate every boundary (env, request bodies, webhooks, custom events) with Zod.
- **Secrets stay on the server.** Only `NEXT_PUBLIC_*` values may reach the browser. Server modules that read secrets import `server-only`.
- **Media SDKs only in adapter folders.** `@stream-io/*` and `livekit-*` may only be imported inside the media adapter folders. UI code talks to the provider-neutral interface.
- **UI text.** Every user-facing string comes from the message files (English first, then es, pt-BR, fr, de, ja), including `aria-label`s, tooltips and screen-reader announcements. Format dates, times and numbers with `Intl`.
- **Familiar words.** Use the words Zoom and Meet users know: Mute / Unmute, Start video / Stop video, Share screen / Stop sharing, Participants, Chat, Raise hand / Lower hand, Waiting room, Admit, Leave meeting, End meeting for all, Meeting ID, Passcode.
- **Icons.** Lucide first; another open-licensed set in the same style only when Lucide has no fit.
- **Accessibility.** WCAG 2.2 AA in light and dark themes: real buttons with labels, visible focus, keyboard access, and tooltips that also appear on focus.

## Definition of done

- Typed, with no `any` leaks.
- A unit and/or E2E test is added.
- Works at 375 px and 1440 px.
- Keyboard accessible, with visible focus, in light and dark themes.
- All UI text comes from the message files.
- No console errors.
- README, AGENTS.md and `.env.example` are updated when behavior or configuration changes.
