<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-mark-dark.svg">
  <img src="public/brand/logo-mark.svg" width="128" alt="">
</picture>

# FaceOn Meetings

**Free, open-source video meetings that run in your browser.**

[![Desktop app](https://img.shields.io/github/v/release/donth77/faceon-meetings?include_prereleases&style=flat-square&label=desktop&color=1F5EFF)](https://github.com/donth77/faceon-meetings/releases)
[![License](https://img.shields.io/badge/license-MIT-1F5EFF?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

<img src=".github/assets/meeting.png" width="820" alt="A FaceOn meeting in gallery view: six people with their cameras off, shown as illustrated avatars. Priya Raman is speaking, outlined in green, and Lucas Moreau has a hand raised. Along the bottom are Mute, Start video, Share screen, Reactions, Raise hand, More and Leave, with Participants and Chat on the right.">

</div>

---

Try it at [joinfaceon.app](https://joinfaceon.app), or [deploy your own](#deploy-your-own).

## What works

- Instant and scheduled meetings, and a personal room
- Join by link or meeting ID; guests need only a name
- Passcodes, a waiting room and host controls
- Chat, reactions, raised hands and screen sharing
- Background blur, backgrounds and noise suppression
- Google Calendar invitations and meeting reminders
- AI notes, if you want them
- Previous meetings, attendance and your data to download
- A [desktop app](desktop/README.md) for Windows and Mac
- FaceOn in [Google Calendar and Gmail](google-addon/README.md)
- In English, Spanish, Portuguese (Brazil), French, German and Japanese

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript) on [Vercel](https://vercel.com)
- [Tailwind CSS](https://tailwindcss.com) 4 and [shadcn/ui](https://ui.shadcn.com), with [Lucide](https://lucide.dev) icons
- [Stream Video](https://getstream.io/video/) for media
- [Better Auth](https://www.better-auth.com) for accounts, [Neon](https://neon.com) Postgres and [Drizzle ORM](https://orm.drizzle.team)
- [Electron](https://www.electronjs.org) for the desktop app

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

The desktop app and the Google add-on have their own guides: [desktop/DEVELOPING.md](desktop/DEVELOPING.md) and [google-addon/DEVELOPING.md](google-addon/DEVELOPING.md).

## Deploy your own

FaceOn runs on free plans. [DEPLOY.md](DEPLOY.md) walks through every step, from the accounts to your own domain.

| For             | Service                                 |
| --------------- | --------------------------------------- |
| Hosting         | [Vercel](https://vercel.com)            |
| Database        | [Neon](https://neon.com)                |
| Audio and video | [Stream](https://getstream.io)          |
| Sign-in         | Google and GitHub                       |
| Email sign-in   | [Resend](https://resend.com) (optional) |

Optional:

- **Protect and watch:** bot checks, error reports, uptime checks and encrypted backups. See [Protect and watch your copy](DEPLOY.md#protect-and-watch-your-copy-optional).
- **Make it yours:** your own name, logo and colors. See [Make it yours](DEPLOY.md#make-it-yours).
- **Apps:** [Desktop app](DEPLOY.md#the-desktop-app-optional) and the [Google Workspace add-on](DEPLOY.md#the-google-workspace-add-on-optional).
