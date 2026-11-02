# FaceOn

Free, open-source video meetings that run in your browser. If you've used Zoom or Google Meet, you already know how to use it.

> **Status:** early development. FaceOn is a working name.

## What it does

- Instant and scheduled meetings (including recurring ones), a personal room, and joining by link or meeting ID
- Invitations through Google Calendar: connect it once, and Google emails the people you invite and keeps their calendars up to date. Links for Google Calendar, Outlook and any calendar app (.ics) work without connecting
- Guests join with just a name; passcodes, a waiting room and host controls keep meetings safe, with co-hosts named ahead of time or made during the meeting
- Chat, reactions, raise hand and screen sharing, with sound where the browser supports it
- Background blur and backgrounds (paintings, places, moving backgrounds, or your own image or looping video), processed on your own device
- Noise suppression that takes typing, traffic and background voices out of your microphone, on your own device (RNNoise)
- Optional AI notes (a summary, action items and decisions), made in the browser: on your own device with Chrome's built-in AI, or with your own AI key, and saved or shared with the participants
- Previous meetings with who came, an attendance spreadsheet for hosts, keyboard shortcuts, and a searchable Help center
- Download your data: your account, meetings, attendance and AI notes, as JSON, CSV and Markdown
- A Google Workspace add-on: FaceOn meeting in Google Calendar's Add video conferencing, a sidebar in Calendar and Gmail, and Insert a FaceOn meeting in Gmail ([google-addon/](google-addon/README.md))
- Works in the browser on Windows, macOS, Linux, iPhone, iPad and Android, and installs as an app (from Chrome or Edge, or Add to Home Screen and Add to Dock in Safari)

On the way: Spanish, Portuguese (Brazil), French, German and Japanese (English only for now), and self-hosted [LiveKit](https://livekit.io) as an alternative to Stream.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript) on [Vercel](https://vercel.com)
- [Tailwind CSS](https://tailwindcss.com) 4 and [shadcn/ui](https://ui.shadcn.com), with [Lucide](https://lucide.dev) icons
- [Stream Video](https://getstream.io/video/) for media
- [Better Auth](https://www.better-auth.com) for accounts, [Neon](https://neon.com) Postgres and [Drizzle ORM](https://orm.drizzle.team)

## Run it locally

Requirements: Node.js 24 and pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # then fill in the values you need
pnpm dev                     # http://localhost:3000
```

Accounts: Google, GitHub, or email and password. Locally, email sign-up works without an email service: the verification and password-reset emails print in the dev server's log, links included.

Useful scripts:

| Command          | What it does                                             |
| ---------------- | -------------------------------------------------------- |
| `pnpm dev`       | Start the dev server                                     |
| `pnpm build`     | Production build                                         |
| `pnpm lint`      | ESLint                                                   |
| `pnpm typecheck` | Generate route types, then run the TypeScript compiler   |
| `pnpm test`      | Unit tests (Vitest)                                      |
| `pnpm test:e2e`  | Browser tests (Playwright) against `pnpm build`'s output |
| `pnpm format`    | Format with Prettier                                     |

## Deploy your own

FaceOn runs on free plans: [Vercel](https://vercel.com) for hosting, [Neon](https://neon.com) for the database and [Stream](https://getstream.io) for audio and video, with Google and GitHub for sign-in and [Resend](https://resend.com) if you want email-and-password accounts. [DEPLOY.md](DEPLOY.md) walks through it step by step: the accounts, every environment variable, the database and Stream setup, Google Calendar, your own domain, updating your copy and troubleshooting.

Bot checks (Cloudflare Turnstile), error reports (Sentry), uptime checks and weekly encrypted backups are optional and free; [Protect and watch your copy](DEPLOY.md#protect-and-watch-your-copy-optional) sets them up. To give your copy its own name, logo and colors, see [Make it yours](DEPLOY.md#make-it-yours) and [BRAND.md](BRAND.md).
