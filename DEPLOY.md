# Deploy your own FaceOn

This guide sets up your own copy of FaceOn on free plans:

- Vercel hosts it.
- Neon keeps the database.
- Stream carries the audio and video.
- Google and GitHub handle sign-in.
- Resend sends account emails, if you want email-and-password accounts.

Plan on about an hour. You need [Node.js](https://nodejs.org) 24, [pnpm](https://pnpm.io) 10 and git on your computer, because a few setup commands run from there.

The examples use `https://faceon.example.com` as the address. Use your own. [`.env.example`](.env.example) lists every setting; this guide says which ones you need and where they come from.

## What you need

| Service                                          | What FaceOn uses it for                        | Free plan, at the time of writing                                                                                                                                                                                          |
| ------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GitHub](https://github.com)                     | Your copy of the code, and Sign in with GitHub | Free                                                                                                                                                                                                                       |
| [Vercel](https://vercel.com/pricing) (Hobby)     | Hosting, and the daily cleanup                 | For personal, non-commercial use. Each month: 1M function invocations, 4 hours of active CPU, 100 GB of fast data transfer. Scheduled jobs run at most once a day                                                          |
| [Neon](https://neon.com/pricing) (Free)          | The Postgres database                          | 1 GB per project and 100 CU-hours of compute a month; the database sleeps after 5 idle minutes. No card. Running out of compute suspends the database until the next month, without deleting anything                      |
| [Stream](https://getstream.io/video/pricing/)    | Audio, video and screen sharing                | The Build plan: $100 of usage every month, no card. How many meeting minutes that covers depends on video quality and how many people join; FaceOn's limits ([step 9](#9-decide-who-hosts-and-set-limits)) keep usage down |
| [Google Cloud](https://console.cloud.google.com) | Sign in with Google, and Google Calendar sync  | Free                                                                                                                                                                                                                       |
| [Resend](https://resend.com/pricing), optional   | Emails for email-and-password accounts         | 3,000 emails a month, 100 a day. Needs a domain you own                                                                                                                                                                    |

LiveKit's settings in `.env.example` aren't read yet. Bot checks (Cloudflare Turnstile), error reports (Sentry), uptime checks and backups are optional and free: [Protect and watch your copy](#protect-and-watch-your-copy-optional) sets them up.

### How much the free plans cover

Estimates for a copy with FaceOn's default limits ([step 9](#9-decide-who-hosts-and-set-limits)). Stream's credit is usually the first limit; the database's awake hours come first if meetings are spread across the day. After a busy week, compare with the Usage pages on Vercel and Neon and Stream's dashboard.

| Service       | Free each month                                                                                                                                                              | What FaceOn uses it for                                                                             | Roughly supports                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Stream        | $100 credit: 333,000 participant-minutes at $0.30 per 1,000 for audio and standard video; HD costs twice that and Full HD four times, by the resolution each person receives | Every minute each person is connected, camera on or off                                             | About 5,550 participant-hours at standard video (below)                                                                               |
| Neon          | 100 CU-hours; the database sleeps after 5 idle minutes                                                                                                                       | Every page and API call that reads data                                                             | About 400 hours awake at the smallest size, roughly 13 hours a day                                                                    |
| Vercel        | 1M function calls, 4 hours of active CPU, 1M CDN requests, 100 GB of transfer                                                                                                | Pages, API calls, the app's files, backgrounds, the effects and noise runtimes                      | Roughly 20,000–30,000 people joining a month; a first visit is about 1.5 MB, or 6–8 MB with a background, and later visits are cached |
| Resend        | 3,000 emails, 100 a day                                                                                                                                                      | Account emails (verifying, password resets), meeting reminders, hosting requests and usage warnings | About 100 emails a day, shared by sign-ups and reminders                                                                              |
| On the device | Nothing                                                                                                                                                                      | Backgrounds, noise suppression, AI notes                                                            | Unlimited                                                                                                                             |

| Meeting                                | Participant-minutes | Meetings a month within Stream's credit |
| -------------------------------------- | ------------------- | --------------------------------------- |
| 4 people × 15 minutes (a demo meeting) | 60                  | About 5,550                             |
| 6 people × 45 minutes                  | 270                 | About 1,230                             |
| 10 people × 60 minutes                 | 600                 | About 555                               |
| 20 people × 60 minutes                 | 1,200               | About 277                               |

Those counts are at Stream's audio and standard-video rate: halve them for HD, or quarter them for Full HD.

Going over Vercel's or Neon's free limits pauses your copy until the next month rather than billing you. Stream doesn't say what it does past the credit on its free plan, so keep the limits in step 9 and watch its dashboard.

The database's sleep costs about a second, once, on the first request after five quiet minutes. FaceOn hides it by waking the database as soon as someone starts to sign in or join (`DATABASE_WAKE_ON_INTENT`, [step 3](#3-set-up-the-database-neon)). Don't add an uptime check or other ping that touches the database: keeping it awake around the clock takes about 180 CU-hours a month, past the free 100.

## 1. Get the code

Fork this repository on GitHub, then clone your fork and install:

```bash
git clone https://github.com/<you>/faceon-meetings.git
cd faceon-meetings
pnpm install
cp .env.example .env.local
```

`.env.local` holds the values for running FaceOn on your computer (`pnpm dev`), and the setup commands below read it too. Git ignores it, so it's never committed. A value you set on the command line wins over the same one in `.env.local`, which is how the commands below reach your production services:

```bash
# bash or zsh
DATABASE_URL_UNPOOLED="postgresql://…" pnpm db:migrate

# PowerShell
$env:DATABASE_URL_UNPOOLED = "postgresql://…"; pnpm db:migrate
```

## 2. Create the Vercel project

1. In Vercel, select **Add New → Project** and import your fork. Vercel detects Next.js and picks Node.js 24 from `package.json`; leave the build settings as they are.
2. Note your address under **Settings → Domains**: `<project>.vercel.app`, with a suffix if that name was taken. You can add a domain of your own now or later ([step 12](#12-use-your-own-domain-optional)).

The first build needs settings from [step 8](#8-add-the-environment-variables-to-vercel), so a build that fails before then is expected.

## 3. Set up the database (Neon)

1. Sign up at [neon.com](https://neon.com) and create a project. Pick the AWS region nearest your Vercel functions; Vercel's default is Washington, D.C., so AWS US East (N. Virginia).
2. Select **Connect** for the `main` branch and copy two connection strings:
   - with **Connection pooling** on, for `DATABASE_URL` (the app)
   - with it off, for `DATABASE_URL_UNPOOLED` (migrations)
3. Create the tables. From your clone, run the migrations in `drizzle/` against that database:

   ```bash
   DATABASE_URL_UNPOOLED="postgresql://…" pnpm db:migrate
   ```

To check both connections, run `pnpm db:check` with both strings set.

Neon's database sleeps after five idle minutes, on every plan unless you turn that off, and takes about a second to wake. FaceOn wakes it when someone starts to sign in or join, so they don't wait. `DATABASE_WAKE_ON_INTENT` decides: `auto` (the default) does this for Neon only; set `off` if your database never sleeps, or `on` for another database that does.

For local development, a second branch keeps test data apart: **Branches → New branch** (for example `dev`), with its strings in `.env.local`, and `pnpm db:migrate` on its own.

## 4. Set up audio and video (Stream)

1. Sign up at [getstream.io](https://getstream.io/try-for-free/) and create an app: environment **Production**, location nearest most of your users.
2. In the app's dashboard, open **Video & Audio** and copy the API key and secret, for `NEXT_PUBLIC_STREAM_API_KEY` and `STREAM_API_SECRET`.
3. Open **Video & Audio → Roles & Permissions**, create a role named `cohost`, and save it without ticking any permissions. The setup script sets them.
4. Run the setup script with your app's keys and your webhook address:

   ```bash
   NEXT_PUBLIC_STREAM_API_KEY="…" STREAM_API_SECRET="…" \
   STREAM_WEBHOOK_URL="https://faceon.example.com/api/webhooks/stream" \
   pnpm stream:setup
   ```

   It's safe to run again. It:
   - creates the `meeting` call type and locks down Stream's built-in call types, so a person's token reaches only the calls FaceOn admitted them to. Host controls go through FaceOn's API, which checks who may do what.
   - creates the `system` user that sends FaceOn's server events (`STREAM_SYSTEM_USER_ID`, `system` unless you change it).
   - adds the webhook, through which Stream tells FaceOn who joined and left, for **Previous**. Stream signs each delivery with your API secret, so there's no separate webhook secret. Stream can't reach `localhost`, so point it at your deployed address.

5. Check the setup, with the same two keys set:
   - `pnpm stream:check` reports anything that differs from what FaceOn expects (exit code 1 if something does).
   - `pnpm stream:lockdown-test` proves the permission boundary against your app. It makes API calls only, no media, so it uses no meeting minutes.

For local development, a second Stream app (environment **Development**, with its own `cohost` role and `pnpm stream:setup`) keeps test calls out of production. Its keys go in `.env.local`.

## 5. Set up Sign in with Google (and Google Calendar)

1. In the [Google Cloud console](https://console.cloud.google.com), create a project.
2. Open **Google Auth Platform** and select **Get started**: your app's name, a support email, audience **External**, and a contact email.
3. Under **Branding**, add your home page (`https://faceon.example.com`), privacy policy (`/privacy`) and terms (`/terms`), and your domain under **Authorized domains**.
4. Under **Clients**, select **Create client → Web application**:
   - **Authorized JavaScript origins:** `https://faceon.example.com`, plus `http://localhost:3000` for local development
   - **Authorized redirect URIs:** `https://faceon.example.com/api/auth/callback/google`, plus `http://localhost:3000/api/auth/callback/google`

   Copy the client ID and secret, for `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. One client serves both addresses.

5. Under **Audience**: while the app is in **Testing**, only the test users you list (up to 100) can sign in with Google. Add yourself. **Publish app** opens Google sign-in to everyone. Sign-in asks only for name, email address and profile picture.

### Google Calendar sync

Hosts who connect Google Calendar (Settings → Calendar) get their meetings added to it, and Google emails the invitations. It's on unless `GOOGLE_CALENDAR_SYNC=off`, and it uses the same Google client:

1. In the same Google Cloud project, open **APIs & Services → Library**, find the **Google Calendar API** and enable it.
2. In **Google Auth Platform → Data access**, select **Add or remove scopes** and add `https://www.googleapis.com/auth/calendar.events.owned`. FaceOn only touches the events it makes.

The scope is sensitive. Until Google verifies your app, only test users can connect, and Google asks them to reconnect every 7 days. Google's verification reviews your home page, privacy policy and how the app uses the scope, and needs a domain you own. With sync off, or for anyone who doesn't connect, each meeting's page still has buttons to add it to Google Calendar, Outlook or any calendar app.

### FaceOn in Google Calendar and Gmail

People can also add FaceOn to Google Calendar and Gmail themselves, from Settings → Calendar: **FaceOn meeting** in Calendar's **Add video conferencing**, a side panel in Calendar and Gmail, and **Insert a FaceOn meeting** in Gmail. FaceOn puts each person's own copy of its add-on in their Google account and keeps it up to date ([The Google Workspace add-on](#the-google-workspace-add-on-optional)). It's on unless `GOOGLE_ADDON=off`, uses the same Google client, and needs your site on `https://`:

1. In the same Google Cloud project, open **APIs & Services → Library**, find the **Apps Script API** and enable it.
2. In **Google Auth Platform → Data access**, select **Add or remove scopes** and add `https://www.googleapis.com/auth/script.projects`. FaceOn only touches the add-on it makes.

This scope is sensitive too, with the same limits until Google verifies your app.

## 6. Set up Sign in with GitHub

A GitHub OAuth app has one callback address, so make one for your site and, for local development, a second one.

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps → New OAuth App**:
   - **Homepage URL:** `https://faceon.example.com`
   - **Authorization callback URL:** `https://faceon.example.com/api/auth/callback/github`
2. Register it, select **Generate a new client secret**, and copy both values, for `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
3. For local development, make a second app with `http://localhost:3000` and `http://localhost:3000/api/auth/callback/github`, and put its values in `.env.local`.

The sign-in page always offers both Google and GitHub, so set up both.

## 7. Set up account emails (Resend, optional)

Email-and-password accounts need email: FaceOn sends a link to verify the address, password resets, a note when a password changes, and a note when someone tries to sign up with an address that already has an account. Without Resend, production offers only Google and GitHub. On your computer, these emails print in the dev server's log instead.

1. At [resend.com](https://resend.com), add a domain you own and the DNS records it shows, and wait until it's verified. A subdomain such as `mail.example.com` works.
2. Create an API key with sending access.
3. Set both `RESEND_API_KEY` and `EMAIL_FROM`, a sender on the verified domain such as `FaceOn <no-reply@mail.example.com>`.

## 8. Add the environment variables to Vercel

In Vercel, open **Settings → Environment Variables** and add these for **Production**. If you want Vercel's preview deployments (one per branch and pull request) to work too, add them for **Preview** as well, perhaps with a separate Neon branch.

Make each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**Your site**

| Variable               | Value                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`  | `https://faceon.example.com`, for Production **and** Preview: preview deployments send sign-in through it               |
| `BETTER_AUTH_URL`      | `https://faceon.example.com`, for Production only                                                                       |
| `NEXT_PUBLIC_APP_NAME` | Optional: the name shown everywhere (FaceOn). [Make it yours](#make-it-yours) changes the logo and colors to match      |
| `NEXT_PUBLIC_REPO_URL` | Optional: your fork's address, for the "View source on GitHub" and "Found an issue?" links. Leave it empty to hide them |

**Database**

| Variable                | Value                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`          | The pooled connection string from [step 3](#3-set-up-the-database-neon) |
| `DATABASE_URL_UNPOOLED` | The direct one                                                          |

**Sign-in**

| Variable                                   | Value                                                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                       | A new secret. It signs sign-in cookies, encrypts stored sign-in tokens and keys the hashes of rate-limited IP addresses. Keep it: changing it signs everyone out                                  |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | From [step 5](#5-set-up-sign-in-with-google-and-google-calendar)                                                                                                                                  |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | From [step 6](#6-set-up-sign-in-with-github)                                                                                                                                                      |
| `GOOGLE_CALENDAR_SYNC`                     | Optional: `off` turns Google Calendar sync off                                                                                                                                                    |
| `GOOGLE_ADDON`                             | Optional: `off` stops offering FaceOn in Google Calendar and Gmail ([The Google Workspace add-on](#the-google-workspace-add-on-optional))                                                         |
| `GOOGLE_ADDON_CONFERENCE_LOGO_URL`         | Optional: the logo Calendar shows beside your meetings, for a copy with its own name. Google shows one only from its own servers                                                                  |
| `BETTER_AUTH_TRUSTED_ORIGINS`              | Optional: more addresses allowed to use sign-in, as exact origins separated by commas (a second domain, say). Your address and each Vercel deployment's own are already allowed. Never a wildcard |

**Guests**

| Variable               | Value                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- |
| `GUEST_SESSION_SECRET` | A new secret. It signs the guest cookie; without it, nobody can join as a guest |
| `ALLOW_GUESTS`         | Optional: `false` turns guests off for every meeting                            |

**Audio and video**

| Variable                     | Value                                                   |
| ---------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_STREAM_API_KEY` | From [step 4](#4-set-up-audio-and-video-stream)         |
| `STREAM_API_SECRET`          | From step 4                                             |
| `STREAM_SYSTEM_USER_ID`      | Optional: only if you changed it when running the setup |

`STREAM_WEBHOOK_URL` is only for the setup script; Vercel doesn't need it. `MEDIA_PROVIDERS` stays `stream`, the only provider so far.

**Email** (optional): `RESEND_API_KEY` and `EMAIL_FROM`, from [step 7](#7-set-up-account-emails-resend-optional).

**The daily cleanup:** `CRON_SECRET`, a new secret ([step 11](#11-check-the-daily-cleanup)); the cleanup also schedules reminder emails. `REMINDER_EMAILS_PER_DAY` is optional (50 by default).

**Usage this month** (optional): `USAGE_STREAM_MINUTES`, `USAGE_EMAILS_PER_DAY`, `USAGE_EMAILS_PER_MONTH` and `USAGE_NEON_CU_HOURS` if your plans differ from the free ones, and `NEON_API_KEY` with `NEON_PROJECT_ID` for the database's meter ([Usage this month](#usage-this-month)).

**Protection and monitoring** (optional): `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` for bot checks, `NEXT_PUBLIC_SENTRY_DSN` (with `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` for source maps) for error reports, and `CONTENT_SECURITY_POLICY`, as in [Protect and watch your copy](#protect-and-watch-your-copy-optional).

**AI notes:** `NEXT_PUBLIC_AI_NOTES` is optional; `off` removes AI notes from your copy. When it's on, each host still decides in Settings → AI notes whether their meetings offer them, and they're off until a host turns them on.

Then add the variables from [step 9](#9-decide-who-hosts-and-set-limits) and [step 10](#10-legal-pages), and open **Deployments** and redeploy. Vercel applies changed variables to new deployments only, and `NEXT_PUBLIC_*` values are built into the pages, so redeploy after every change.

## 9. Decide who hosts, and set limits

Limits keep usage inside Stream's free credit. Everyone who signs in can host, but only approved hosts host full meetings; everyone else hosts demo meetings. Approve people in your settings below, or in Settings → Admin once you're signed in (see [Admins, and Settings → Admin](#admins-and-settings--admin)):

| Variable                       | Default | What it does                                                                                              |
| ------------------------------ | ------- | --------------------------------------------------------------------------------------------------------- |
| `ADMIN_EMAILS`                 |         | Your own addresses, separated by commas. They host full meetings and see Settings → Admin                 |
| `HOST_ALLOWLIST`               |         | Other addresses that host full meetings. Settings → Admin lists them but can't change them                |
| `MAX_PARTICIPANTS_PER_MEETING` | 20      | People in a full meeting. The meeting's host always gets in; Stream's own cap sits 2 above, as a backstop |
| `MAX_MEETING_MINUTES`          | 0       | How long a full meeting can last; 0 for no limit                                                          |
| `DEMO_MAX_MINUTES`             | 15      | How long a demo meeting can last. Everyone not listed above hosts demo meetings                           |
| `DEMO_MAX_PARTICIPANTS`        | 4       | People in a demo meeting                                                                                  |
| `DEMO_MEETINGS_PER_DAY`        | 3       | Demo meetings a host can start in a day                                                                   |
| `MAX_CONCURRENT_MEETINGS`      | 10      | Meetings running at once across your whole copy. Past it, people are asked to try again shortly           |
| `MEETINGS_PER_USER_PER_DAY`    | 20      | Meetings one account can create in a day                                                                  |
| `ALONE_TIMEOUT_MINUTES`        | 10      | Ask "Are you still there?" after someone has been alone in a meeting this long; 0 turns it off            |

A listed address counts only once it's verified. Google and GitHub sign-ins are; an email account is once its owner follows the link FaceOn sends.

### Admins, and Settings → Admin

Admins are the addresses in `ADMIN_EMAILS`, and only those: the app can't add or remove an admin. Signed in, an admin finds **Admin** in Settings (also in the account menu), at `/settings/admin`. It's about one thing, who hosts full meetings:

- **Requests.** A demo host can select **Ask for full meetings** on Home and add a note. Admins get an email, then **Approve** or **Decline** in Settings → Admin, and the person gets an email with the answer. After a decline they can ask again in 30 days.
- **Approved hosts.** Add an address before or after its owner signs up; their meetings are full from their next one. **Move to demo** takes someone back to demo meetings from their next meeting (a meeting already running keeps its limits), without an email. Addresses from `HOST_ALLOWLIST` show as "From settings" and change only there.

Admins can't delete, edit or sign in as anyone's account, and Settings → Admin shows nothing of anyone's meetings, notes or settings: only what a hosting decision needs (name, email, whether an account exists, the note sent with a request, and past answers). Each action is its own server function that checks the caller is an admin; there's no general user management. Everyone else gets a "page not found" there.

Emails to admins and about answers go through Resend ([step 7](#7-set-up-account-emails-resend-optional)). Without it, requests still appear in Settings → Admin, but nobody is emailed.

## 10. Legal pages

The privacy policy and terms (`/privacy` and `/terms`, from [`content/legal/`](content/legal/)) speak for whoever runs the copy. Set:

| Variable                            | Value                                                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_OPERATOR_NAME`         | Who runs this copy                                                                                                                                                   |
| `NEXT_PUBLIC_CONTACT_EMAIL`         | Where people write about privacy or the terms. Without it, the pages point to the repository's issues                                                                |
| `NEXT_PUBLIC_OPERATOR_JURISDICTION` | Whose laws govern the terms, as it reads after "the laws of", such as `the State of New York, USA`. Without it, the terms name the place where the operator is based |

The privacy policy, terms and credits are translated too, each saying the English version governs. A translation shows only while its `updated` date matches the English page's, so after you change a legal page, translate it again; until then, people see your English.

## 11. Check the daily cleanup

[`vercel.json`](vercel.json) runs `/api/cron/sweep` once a day at 05:00 UTC (on Vercel's free plan, any time in that hour). It closes meetings left open, deletes meetings that have expired, drops old records as the privacy policy says, such as attendance and saved AI notes after 90 days, schedules the next two days' reminder emails, and checks usage against the free plans.

Vercel sends `CRON_SECRET` with each run, and without it the cleanup turns every request away. To run it yourself:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://faceon.example.com/api/cron/sweep
```

It answers with what it did, such as `"closedSessions": 0`. Scheduled runs don't follow redirects, so the cleanup has to answer at your production address itself.

### Reminder emails (optional)

People with an account can turn on **Email me before my meetings** in Settings → Notifications. The emails need only account emails ([step 7](#7-set-up-account-emails-resend-optional)) and the daily cleanup: nothing outside calls FaceOn on a timer. FaceOn hands each reminder to Resend ahead of time with its send time, up to two days ahead, whenever a meeting or someone's reminder settings change and again in the daily cleanup, and Resend holds it until it's due. A changed or cancelled meeting updates or cancels its waiting reminders.

Each reminder goes once, and at most `REMINDER_EMAILS_PER_DAY` go a day (50 by default), counted by the day they're sent, which leaves room for account emails in Resend's free 100 a day; a day that's full gets no more. A meeting saved after its reminder time has passed gets no reminder. Every email has a link that turns them off, and mail apps offer the same in one click.

## 12. Use your own domain (optional)

In Vercel, open **Settings → Domains**, add your domain and follow the DNS instructions. Then update everything that names your address, as in [Moving to another domain](#moving-to-another-domain).

## 13. Sign in and check it works

1. Open your address and sign in with Google (as a test user while the Google app is in Testing) or GitHub.
2. If your address is in `ADMIN_EMAILS` or `HOST_ALLOWLIST`, Home doesn't say "Your meetings are demos for now".
3. Select **New meeting → Start an instant meeting**, then join from another device, or a private window, as a guest with the link.
4. Leave the meeting. **Previous** lists it with who came. If it doesn't, the webhook isn't reaching your copy (see [Troubleshooting](#troubleshooting)).
5. If you set up Google Calendar, connect it in **Settings → Calendar**, schedule a meeting, and look for it in your calendar.
6. Run the cleanup once ([step 11](#11-check-the-daily-cleanup)) and `pnpm stream:check`.

## Protect and watch your copy (optional)

None of these needs an account to start with, and each stays off until you set it up.

### Security headers and the Content Security Policy

Every page is sent with headers that keep other sites from framing FaceOn, keep the camera, microphone, screen capture and full screen to FaceOn's own pages, give other sites only your address's origin as the referrer (never a page's address), and stop browsers guessing file types. Vercel adds HTTPS-only (HSTS) itself.

A Content Security Policy lists where pages may load code and media from and connect to: your site, Stream, the AI providers a host's own key can call, Google and GitHub profile photos, and Turnstile and your error reports when they're on. It starts **report-only**: browsers report anything outside it to `/api/csp-report`, which writes one line per report to the server log, such as `csp report: connect-src blocked https://example.com on /j/:code`, and nothing is blocked. In Vercel, open **Logs** and search for `csp`.

Once a week of ordinary use has passed with no reports you can't explain, set `CONTENT_SECURITY_POLICY=enforce` and redeploy, so browsers block those too. `off` leaves the policy out. If you change your copy to call another service from the browser, add its address in `src/lib/security/csp.ts`.

### Bot checks (Cloudflare Turnstile)

Turnstile checks there's a person behind the requests that send email (signing up, asking for a password reset, and asking for the verification email again), and behind a guest's first join from a browser, since guests take seats and Stream minutes. Most people never see it: Cloudflare asks for a click only when it isn't sure. Signing in, and signing in with Google or GitHub, aren't checked; failed sign-ins are already limited, and Google and GitHub screen for bots themselves.

1. Make a free [Cloudflare](https://dash.cloudflare.com/sign-up) account and open **Turnstile → Add widget**.
2. Name it, add your domain (and `localhost` if you want the check in development), and choose **Managed**.
3. Copy the **site key** into `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the **secret key** into `TURNSTILE_SECRET_KEY` in Vercel (Production only, unless the widget also lists your preview addresses), and redeploy.

A guest's join accepts a token only when Cloudflare says it was passed on your site's own address (`NEXT_PUBLIC_APP_URL`); list any other domain the widget serves in `TURNSTILE_HOSTNAMES`.

Without both keys there's no check.

### Error reports (Sentry or GlitchTip)

When something breaks, a report goes to [Sentry](https://sentry.io) so you can fix it. A report holds the error, where in the code it happened, the browser and operating system, and the page's address with meeting IDs and passcodes taken out. It never holds names, email addresses, IP addresses, chat, notes, transcripts or AI keys (`src/lib/monitoring/scrub.ts` removes them first), and there's no performance tracing or session replay. In the browser, Sentry's code loads only once a page is idle.

1. Make a Sentry account (the free Developer plan is enough) and an organization. Choose where its data is stored, in the US or the EU.
2. Create a project for **Next.js** and copy its DSN into `NEXT_PUBLIC_SENTRY_DSN` in Vercel.
3. In the project's **Settings → Security & Privacy**, turn on **Prevent Storing of IP Addresses**. FaceOn doesn't send them; this makes sure.
4. For readable stack traces, create an auth token under **Settings → Auth Tokens** and set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` (the organization's slug) and `SENTRY_PROJECT` (the project's) in Vercel. Each build then uploads its source maps to Sentry and deletes them, so they're never served.
5. Redeploy.

[GlitchTip](https://glitchtip.com), an open-source service compatible with Sentry that you can host yourself, works the same way: use its DSN, and for source maps also set `SENTRY_URL` to its address.

### Uptime checks

`/api/health` answers `{"ok":true}` while your copy is up. It doesn't touch the database, so checking it every few minutes never keeps Neon awake. With [UptimeRobot](https://uptimerobot.com)'s free plan, add a monitor: **HTTP(s)**, `https://faceon.example.com/api/health`, every 5 minutes, alerting you by email.

`/api/health?db=1` also checks the database, and answers 503 when it can't reach it. Each check wakes a sleeping database for 5 minutes of Neon's monthly compute, so give it a slow monitor of its own, every 12 hours say.

### Usage this month

**Settings → Admin → Usage this month** shows how much of each free plan this month has used: Stream's participant-minutes (FaceOn's own count; Stream's dashboard is what's billed), emails today and this month (from Resend), Neon's compute hours, and a link to Vercel's usage page, since Vercel emails its own warnings. The daily cleanup emails the admins (`ADMIN_EMAILS`) once when a meter passes 80%, and again at 100%; that needs Resend.

The limits default to the free plans; set the `USAGE_*` settings if yours differ (0 means no limit). For Neon's meter, create a project-scoped API key in the Neon console (your organization's **Settings → API keys → Create new → Project-scoped**, for this project) and copy the project's ID (its **Settings → General**). Set them as `NEON_API_KEY` (sensitive) and `NEON_PROJECT_ID` in Vercel, and redeploy.

### Backups

`.github/workflows/backup.yml` makes a copy of the database every Monday: it dumps it, restores the dump into a throwaway Postgres to prove it works (the run's summary lists each table's rows), encrypts it for a key only you hold, and keeps it as an artifact of the run for 90 days.

1. Install [age](https://age-encryption.org) and make a key: `age-keygen -o faceon-backup-key.txt`. It prints the public key, `age1…`. Keep the file somewhere safe outside the repository, such as a password manager: without it, the backups can't be opened.
2. In GitHub, under **Settings → Secrets and variables → Actions**, add `BACKUP_DATABASE_URL` (the direct connection string, your `DATABASE_URL_UNPOOLED`) and `BACKUP_AGE_RECIPIENT` (the public key).
3. To try it all on a throwaway database first, open **Actions → Backup → Run workflow** and tick **selftest**: no secrets needed, and nothing is kept.

To restore one, download it from the run (**Actions → Backup →** the run **→ Artifacts**; the zip holds `faceon-<date>.dump.age`), then:

```bash
age --decrypt --identity faceon-backup-key.txt --output faceon.dump faceon-<date>.dump.age
pg_restore --no-owner --no-privileges --dbname "postgresql://…" faceon.dump
```

Restore into a new, empty database, such as a new Neon branch, rather than over the one in use. Check it, then point `DATABASE_URL` and `DATABASE_URL_UNPOOLED` at it and redeploy. `pg_restore` must be the same major version as your database or later (`select version()` shows it).

## Make it yours

Your copy can have its own name, logo and colors:

- **Name:** `NEXT_PUBLIC_APP_NAME` ([step 8](#8-add-the-environment-variables-to-vercel)). Pages, Help, emails, the legal pages, calendar files and the installed app all use it.
- **Logo, icons and colors:** `pnpm brand`, below.
- **Email sender:** the name in `EMAIL_FROM`, such as `Acme Meet <no-reply@mail.example.com>` ([step 7](#7-set-up-account-emails-resend-optional)).
- **Legal pages:** [step 10](#10-legal-pages).
- **Languages:** English, Spanish, Portuguese (Brazil), French, German and Japanese. FaceOn follows each person's browser, they can choose from the language menu or Settings (kept with their account), and `?hl=` shows any page in a given language; the sitemap lists each. New text goes in `messages/en.json` first, and the other languages follow the glossary in AGENTS.md. The Google add-on follows each person's Google language.
- **Domain:** [step 12](#12-use-your-own-domain-optional).
- **Source links:** `NEXT_PUBLIC_REPO_URL`, your fork's address. Every GitHub link in the app reads it: the footer's "View source on GitHub", Help's "Found an issue?", the legal pages' contact when there's no `NEXT_PUBLIC_CONTACT_EMAIL`, and `/llms.txt`. Leave it empty to hide them.

### pnpm brand

Edit [`brand/brand.json`](brand/brand.json), put your mark in `brand/` as SVG, then run:

```bash
pnpm brand
```

It writes the logo files in `public/brand/` (the mark, and the mark beside the name, for light and dark backgrounds and in one color, plus a PNG of the mark beside the name for emails), the browser tab icon (`src/app/icon.svg`, `favicon.ico`), the icons for phones and installed apps (`src/app/apple-icon.png`, `public/icons/`), the link preview (`src/app/opengraph-image.png`), the Google Workspace add-on's Marketplace icons and banner (`google-addon/assets/`), and the brand colors for both themes (`src/app/brand.css`, with a copy in `src/lib/brand.ts` for emails and the offline page). Commit them and push. The smallest config:

```json
{
  "name": "Acme Meet",
  "color": "#0f766e",
  "mark": "mark.svg",
  "preview": { "title": "Video meetings for Acme" }
}
```

| Key                                   | What it is                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`                                | The name in the logo. Use the same one as `NEXT_PUBLIC_APP_NAME`                                                                                                   |
| `color`                               | Your brand color, for buttons, links, focus rings and what's selected. It has to be dark enough for text on white                                                  |
| `mark`                                | Your mark, as SVG: shapes, not text, with holes cut out rather than drawn in white. Any size or shape                                                              |
| `markDark`                            | Optional: your mark drawn for dark backgrounds, with the same `viewBox`. Without it, the parts in your brand color take the dark theme's version                   |
| `wordmark.font`                       | Optional: a `.ttf` or `.otf` file for the name. It defaults to Bricolage Grotesque Bold, the display font in `brand/fonts/`                                        |
| `wordmark.accent`                     | Optional: the end of the name to draw in your brand color, as "On" in FaceOn                                                                                       |
| `wordmark.tracking`, `wordmark.pairs` | Optional: space after every letter, and between particular pairs (`{ "Fa": -22 }`), in the font's units                                                            |
| `lockup`                              | Optional: `capHeight`, `gap` and `middle`, in your mark's own units, to place the name beside the mark. By default its capitals are about 3/5 of the mark's height |
| `iconBackground`                      | Optional: the color behind icons that can't be transparent, as on phones' home screens. White by default                                                           |
| `preview`                             | The link preview: a `title`, an optional `subtitle`, and optional `art`, an SVG drawn over the lower part of its 1200 × 630 canvas                                 |
| `colors`                              | Optional: any of the worked-out colors below, to use as given                                                                                                      |

The colors come from your one color. The light theme uses it as it is. The dark theme gets a lighter shade of it that reads on dark surfaces, and each theme gets a soft tint (for chips and the current item) and a shade for text on that tint. Every pair the app uses is checked for [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) contrast: labels on buttons, brand-colored text and focus rings on each surface, and text and icons on the tint. If one fails, `pnpm brand` writes nothing and names the pair, its contrast and what to change; for a color too light to read on white, that's the nearest darker shade that passes. To try a color first:

```bash
pnpm brand --try "#0f766e"
```

FaceOn's own `brand/` uses every option: its mark and a version for dark backgrounds, the wordmark's spacing, the link preview's art and its hand-picked colors.

The four abstract backgrounds are drawn in FaceOn's colors by `scripts/backgrounds.ts`. They're backgrounds, not branding, but you can change their colors and run it too.

## The desktop app (optional)

The desktop app for macOS and Windows lives in `desktop/`. A copy builds its own: set `FACEON_APP_URL` (your site) and `NEXT_PUBLIC_APP_NAME` in `desktop/.env.local`, run `pnpm desktop:icons` after `pnpm brand`, and follow [desktop/RELEASING.md](desktop/RELEASING.md) for signing the Mac app (on your own Mac, or on GitHub's with your Apple Developer certificate) and the Windows app on your own PC, and for releases. Once a release is out, set `DESKTOP_RELEASES_REPO` (the releases repository, as `owner/name`) in Vercel too: `/download`, Settings → General and the account menu then offer **Download for Windows** or **Download for Mac** on those computers only (the landing page, Settings → General, the account menu), straight to the latest installer, and `/download` has every build. The installers keep the same names in every release, so `releases/latest/download/<name>` still finds them when GitHub's API can't be asked. Set `DESKTOP_SIGNED` to `windows`, `mac` or both once those builds are signed or notarized; until then `/download` says how to open them the first time.

## The Google Workspace add-on (optional)

The add-on in `google-addon/` puts **FaceOn meeting** in Google Calendar's **Add video conferencing**, a side panel in Calendar and Gmail, and **Insert a FaceOn meeting** in Gmail's compose window ([google-addon/README.md](google-addon/README.md)). Nothing is published anywhere: people add it themselves, from Settings → Calendar.

1. **Add.** FaceOn asks Google for permission to create Apps Script projects in the person's account, then makes their own copy of the add-on there (an Apps Script project named after your copy, built for your address).
2. **Install.** In Google's Apps Script editor, **Deploy → Test deployments → Install**. Settings links straight to it. Google installs an add-on that isn't in its Marketplace only this way, so this one click can't be skipped.
3. **Use.** The first time, Google asks them to allow it and warns that it isn't verified, since it's their own unlisted copy: **Advanced → Go to FaceOn**. The copy then connects itself to their account. FaceOn accepts it only from that person's Google account, so a copy someone shares doesn't work for anyone else.

After you deploy a change to the add-on, each copy is updated the next time it's used. If Google no longer lets FaceOn write to someone's copy, Settings → Calendar asks them to allow it again. **Remove** in Settings stops FaceOn accepting it; they uninstall it in Apps Script (**Deploy → Test deployments → Uninstall**).

Your part is in [step 5](#faceon-in-google-calendar-and-gmail): the Apps Script API and the `script.projects` scope. If someone's own Apps Script API setting is off, Settings sends them to <https://script.google.com/home/usersettings> to turn it on. Calendar shows FaceOn's logo beside a meeting only from Google's servers: a copy named FaceOn has it already, and one with another name can set `GOOGLE_ADDON_CONFERENCE_LOGO_URL` to an image Google hosts (a [draft Marketplace listing](google-addon/DEVELOPING.md#your-own-logo-in-calendar)'s icon, for one).

Working on the add-on itself is in [google-addon/DEVELOPING.md](google-addon/DEVELOPING.md), and [google-addon/QA.md](google-addon/QA.md) is the checklist before a change. A `google-addon-v*` tag attaches a developer's build to that GitHub release.

## CI secrets (optional)

GitHub Actions runs the browser tests on every push, against a database it throws away afterwards. The tests that join calls also need a **development** Stream app, never your production one. Add two repository secrets under **Settings → Secrets and variables → Actions → New repository secret**:

| Secret                  | Value                                                       |
| ----------------------- | ----------------------------------------------------------- |
| `STREAM_DEV_API_KEY`    | The API key of the Stream app you use for local development |
| `STREAM_DEV_API_SECRET` | That app's secret                                           |

Without them, those tests are skipped and every other test still runs; the job's summary says which. Backups take two more secrets of their own ([Backups](#backups)). Nothing else is needed: each run makes its own throwaway secrets. While a repository is private, Actions minutes come from a monthly allowance, and the nightly workflow runs weekly to save them.

## Updating your copy

Migrations aren't applied when Vercel deploys, so apply them before the new code goes live:

```bash
git remote add upstream <this repository's address>   # once
git pull upstream main
pnpm install
DATABASE_URL_UNPOOLED="postgresql://…" pnpm db:migrate
git push                                                 # Vercel deploys main
```

Then:

- Compare `.env.example` with what you have, and add any new settings in Vercel.
- If you've [made it yours](#make-it-yours), keep your `brand/` folder and run `pnpm brand` again, so the files it writes stay yours.
- Run `pnpm stream:check` with your production keys. If it reports a difference, run `pnpm stream:setup` again (with `STREAM_WEBHOOK_URL`, so the webhook stays).

## Moving to another domain

1. **Vercel:** add the new domain. Change `NEXT_PUBLIC_APP_URL` (Production and Preview) and `BETTER_AUTH_URL` (Production) to it, and redeploy. Once that deployment is live, set the old domain to redirect to the new one, so links people already have keep working.
2. **Stream:** run `pnpm stream:setup` again with `STREAM_WEBHOOK_URL=https://<new domain>/api/webhooks/stream`. It replaces the old webhook.
3. **Google:** in the OAuth client, add the new JavaScript origin and `https://<new domain>/api/auth/callback/google`. Update the home page, privacy policy, terms and authorized domains under **Branding**.
4. **GitHub:** change the OAuth app's homepage and callback to `https://<new domain>/api/auth/callback/github`. It has only one callback, so Sign in with GitHub stops working at the old address.
5. **Resend:** nothing changes, unless your email domain does too.
6. **Reminder emails:** nothing to do. The next daily cleanup reschedules waiting reminders with the new address.
7. **Installed apps** belong to the address they were installed from. People who added FaceOn to their home screen or dock add it again from the new address.

## Troubleshooting

**The build fails with "DATABASE_URL is not set."** Add `DATABASE_URL` and `BETTER_AUTH_SECRET` for that environment (Production or Preview), and redeploy.

**Google says "Error 400: redirect_uri_mismatch".** The client's redirect URI must be exactly `https://<your address>/api/auth/callback/google`.

**Google says "Access blocked: … has not completed the Google verification process".** While the app is in Testing, only test users can sign in. Add the account under **Audience → Test users**, or publish the app.

**GitHub says "The redirect_uri is not associated with this application".** The OAuth app's callback must be exactly `https://<your address>/api/auth/callback/github`, and each app has only one.

**There's no email sign-up.** Production offers it only when both `RESEND_API_KEY` and `EMAIL_FROM` are set. Set them and redeploy.

**Verification emails don't arrive.** Check that the domain is verified in Resend, that `EMAIL_FROM` uses it, and Resend's logs.

**Meetings stop after 15 minutes, or at 4 people.** Those are demo limits. Approve the address in Settings → Admin, or add it to `HOST_ALLOWLIST` or `ADMIN_EMAILS` and redeploy, and make sure it's verified.

**"Too many meetings are running right now."** `MAX_CONCURRENT_MEETINGS` is reached.

**Joining a meeting fails.** Run `pnpm stream:check` with your production keys. If the `meeting` call type is missing or differs, run `pnpm stream:setup`; it needs the `cohost` role from [step 4](#4-set-up-audio-and-video-stream).

**Guests can't join.** Set `GUEST_SESSION_SECRET`, check that `ALLOW_GUESTS` isn't `false`, and check that the host allows guests in that meeting.

**Previous stays empty.** The webhook must point at `https://<your address>/api/webhooks/stream` and belong to the same Stream app whose secret is in Vercel: FaceOn turns away deliveries it can't verify. Stream's dashboard shows webhook deliveries.

**The cleanup returns 401.** Set `CRON_SECRET` in Vercel and redeploy.

**The database stops answering.** Neon's free compute or data transfer for the month is used up. It comes back next month, or on a paid plan.

**Google Calendar says it couldn't update.** Check that the Google Calendar API is enabled in the same project as the OAuth client. A test user also has to reconnect every 7 days until Google verifies the app.

**Adding FaceOn to Google Calendar says whoever runs FaceOn needs to turn on the Apps Script API.** Enable the **Apps Script API** in the same Google Cloud project as the OAuth client (admins see a link to it in Settings → Calendar).

**Sign-in fails on a second address.** Add it to `BETTER_AUTH_TRUSTED_ORIGINS` as an exact origin, such as `https://other.example.com`.
