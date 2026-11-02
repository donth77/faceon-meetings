# FaceOn

Free, open-source video meetings that run in your browser. If you've used Zoom or Google Meet, you already know how to use it.

> **Status:** early development. FaceOn is a working name.

## What it does (planned)

- Instant and scheduled meetings (including recurring ones), a personal room, and joining by link or meeting ID
- Guests join with just a name; passcodes, a waiting room and host controls keep meetings safe
- Chat, reactions, raise hand and screen sharing, with sound where the browser supports it
- Background blur and backgrounds (paintings, places, moving backgrounds, or your own image or looping video), processed on your own device
- Optional AI notes (a summary, action items and decisions), made in the browser: on your own device with Chrome's built-in AI, or with your own AI key
- Works on Windows, macOS, Linux, iPhone, iPad and Android, and installs as an app
- Six languages: English, Spanish, Portuguese (Brazil), French, German and Japanese

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript) on [Vercel](https://vercel.com)
- [Tailwind CSS](https://tailwindcss.com) 4 and [shadcn/ui](https://ui.shadcn.com), with [Lucide](https://lucide.dev) icons
- [Stream Video](https://getstream.io/video/) for media, with self-hosted [LiveKit](https://livekit.io) as an open-source alternative
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

| Command          | What it does                                           |
| ---------------- | ------------------------------------------------------ |
| `pnpm dev`       | Start the dev server                                   |
| `pnpm build`     | Production build                                       |
| `pnpm lint`      | ESLint                                                 |
| `pnpm typecheck` | Generate route types, then run the TypeScript compiler |
| `pnpm test`      | Unit tests (Vitest)                                    |
| `pnpm format`    | Format with Prettier                                   |

## Deploy your own

FaceOn is designed to run on free tiers. A step-by-step guide to deploying your own copy (Vercel, Stream and Neon accounts, plus every environment variable) will be added here as the features land. `.env.example` lists every variable.

Email and password accounts need email delivery: a free [Resend](https://resend.com) account with a verified sending domain (a subdomain of a domain you already own works), set as `RESEND_API_KEY` and `EMAIL_FROM`. Until both are set, production offers only Google and GitHub.

The privacy policy and terms (`/privacy`, `/terms`, from `content/legal/`) speak for whoever runs the copy. Set `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_OPERATOR_JURISDICTION` so they name you, and have them reviewed for where you are.
