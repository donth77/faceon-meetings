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

Settings in `.env.example` for Turnstile, Sentry and LiveKit aren't read yet, so you can leave them empty.

## 1. Get the code

Fork this repository on GitHub, then clone your fork and install:

```bash
git clone https://github.com/<you>/face-on.git
cd face-on
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
| `NEXT_PUBLIC_APP_NAME` | Optional: the name shown everywhere (FaceOn)                                                                            |
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

**The daily cleanup:** `CRON_SECRET`, a new secret ([step 11](#11-check-the-daily-cleanup)).

**AI notes:** `NEXT_PUBLIC_AI_NOTES` is optional; `off` removes AI notes from your copy. When it's on, each host still decides in Settings → AI notes whether their meetings offer them, and they're off until a host turns them on.

Then add the variables from [step 9](#9-decide-who-hosts-and-set-limits) and [step 10](#10-make-the-legal-pages-yours), and open **Deployments** and redeploy. Vercel applies changed variables to new deployments only, and `NEXT_PUBLIC_*` values are built into the pages, so redeploy after every change.

## 9. Decide who hosts, and set limits

Limits keep usage inside Stream's free credit. Everyone who signs in can host, but only the addresses you list host full meetings:

| Variable                       | Default | What it does                                                                                    |
| ------------------------------ | ------- | ----------------------------------------------------------------------------------------------- |
| `ADMIN_EMAILS`                 |         | Your own addresses, separated by commas. They host full meetings                                |
| `HOST_ALLOWLIST`               |         | Other addresses that host full meetings                                                         |
| `MAX_PARTICIPANTS_PER_MEETING` | 20      | People in a full meeting                                                                        |
| `MAX_MEETING_MINUTES`          | 0       | How long a full meeting can last; 0 for no limit                                                |
| `DEMO_MAX_MINUTES`             | 15      | How long a demo meeting can last. Everyone not listed above hosts demo meetings                 |
| `DEMO_MAX_PARTICIPANTS`        | 4       | People in a demo meeting                                                                        |
| `DEMO_MEETINGS_PER_DAY`        | 3       | Demo meetings a host can start in a day                                                         |
| `MAX_CONCURRENT_MEETINGS`      | 10      | Meetings running at once across your whole copy. Past it, people are asked to try again shortly |
| `MEETINGS_PER_USER_PER_DAY`    | 20      | Meetings one account can create in a day                                                        |
| `ALONE_TIMEOUT_MINUTES`        | 10      | Ask "Are you still there?" after someone has been alone in a meeting this long; 0 turns it off  |

A listed address counts only once it's verified. Google and GitHub sign-ins are; an email account is once its owner follows the link FaceOn sends.

## 10. Make the legal pages yours

The privacy policy and terms (`/privacy` and `/terms`, from [`content/legal/`](content/legal/)) speak for whoever runs the copy. Set:

| Variable                            | Value                                                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_OPERATOR_NAME`         | Who runs this copy                                                                                                                                                   |
| `NEXT_PUBLIC_CONTACT_EMAIL`         | Where people write about privacy or the terms. Without it, the pages point to the repository's issues                                                                |
| `NEXT_PUBLIC_OPERATOR_JURISDICTION` | Whose laws govern the terms, as it reads after "the laws of", such as `the State of New York, USA`. Without it, the terms name the place where the operator is based |

Read both documents, change them in `content/legal/` wherever your copy works differently, and have them reviewed for where you are.

## 11. Check the daily cleanup

[`vercel.json`](vercel.json) runs `/api/cron/sweep` once a day at 05:00 UTC (on Vercel's free plan, any time in that hour). It closes meetings left open, deletes meetings that have expired, and drops old records as the privacy policy says, such as attendance and saved AI notes after 90 days.

Vercel sends `CRON_SECRET` with each run, and without it the cleanup turns every request away. To run it yourself:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://faceon.example.com/api/cron/sweep
```

It answers with what it did, such as `"closedSessions": 0`. Scheduled runs don't follow redirects, so the cleanup has to answer at your production address itself.

## 12. Use your own domain (optional)

In Vercel, open **Settings → Domains**, add your domain and follow the DNS instructions. Then update everything that names your address, as in [Moving to another domain](#moving-to-another-domain).

## 13. Sign in and check it works

1. Open your address and sign in with Google (as a test user while the Google app is in Testing) or GitHub.
2. If your address is in `ADMIN_EMAILS` or `HOST_ALLOWLIST`, Home doesn't say "Your meetings are demos for now".
3. Select **New meeting → Start an instant meeting**, then join from another device, or a private window, as a guest with the link.
4. Leave the meeting. **Previous** lists it with who came. If it doesn't, the webhook isn't reaching your copy (see [Troubleshooting](#troubleshooting)).
5. If you set up Google Calendar, connect it in **Settings → Calendar**, schedule a meeting, and look for it in your calendar.
6. Run the cleanup once ([step 11](#11-check-the-daily-cleanup)) and `pnpm stream:check`.

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
- Run `pnpm stream:check` with your production keys. If it reports a difference, run `pnpm stream:setup` again (with `STREAM_WEBHOOK_URL`, so the webhook stays).

## Moving to another domain

1. **Vercel:** add the new domain. Change `NEXT_PUBLIC_APP_URL` (Production and Preview) and `BETTER_AUTH_URL` (Production) to it, and redeploy. Once that deployment is live, set the old domain to redirect to the new one, so links people already have keep working.
2. **Stream:** run `pnpm stream:setup` again with `STREAM_WEBHOOK_URL=https://<new domain>/api/webhooks/stream`. It replaces the old webhook.
3. **Google:** in the OAuth client, add the new JavaScript origin and `https://<new domain>/api/auth/callback/google`. Update the home page, privacy policy, terms and authorized domains under **Branding**.
4. **GitHub:** change the OAuth app's homepage and callback to `https://<new domain>/api/auth/callback/github`. It has only one callback, so Sign in with GitHub stops working at the old address.
5. **Resend:** nothing changes, unless your email domain does too.
6. **Installed apps** belong to the address they were installed from. People who added FaceOn to their home screen or dock add it again from the new address.

## Troubleshooting

**The build fails with "DATABASE_URL is not set."** Add `DATABASE_URL` and `BETTER_AUTH_SECRET` for that environment (Production or Preview), and redeploy.

**Google says "Error 400: redirect_uri_mismatch".** The client's redirect URI must be exactly `https://<your address>/api/auth/callback/google`.

**Google says "Access blocked: … has not completed the Google verification process".** While the app is in Testing, only test users can sign in. Add the account under **Audience → Test users**, or publish the app.

**GitHub says "The redirect_uri is not associated with this application".** The OAuth app's callback must be exactly `https://<your address>/api/auth/callback/github`, and each app has only one.

**There's no email sign-up.** Production offers it only when both `RESEND_API_KEY` and `EMAIL_FROM` are set. Set them and redeploy.

**Verification emails don't arrive.** Check that the domain is verified in Resend, that `EMAIL_FROM` uses it, and Resend's logs.

**Meetings stop after 15 minutes, or at 4 people.** Those are demo limits. Add your address to `HOST_ALLOWLIST` or `ADMIN_EMAILS`, make sure it's verified, and redeploy.

**"Too many meetings are running right now."** `MAX_CONCURRENT_MEETINGS` is reached.

**Joining a meeting fails.** Run `pnpm stream:check` with your production keys. If the `meeting` call type is missing or differs, run `pnpm stream:setup`; it needs the `cohost` role from [step 4](#4-set-up-audio-and-video-stream).

**Guests can't join.** Set `GUEST_SESSION_SECRET`, check that `ALLOW_GUESTS` isn't `false`, and check that the host allows guests in that meeting.

**Previous stays empty.** The webhook must point at `https://<your address>/api/webhooks/stream` and belong to the same Stream app whose secret is in Vercel: FaceOn turns away deliveries it can't verify. Stream's dashboard shows webhook deliveries.

**The cleanup returns 401.** Set `CRON_SECRET` in Vercel and redeploy.

**The database stops answering.** Neon's free compute or data transfer for the month is used up. It comes back next month, or on a paid plan.

**Google Calendar says it couldn't update.** Check that the Google Calendar API is enabled in the same project as the OAuth client. A test user also has to reconnect every 7 days until Google verifies the app.

**Sign-in fails on a second address.** Add it to `BETTER_AUTH_TRUSTED_ORIGINS` as an exact origin, such as `https://other.example.com`.
