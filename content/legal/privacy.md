---
title: Privacy policy
updated: 2026-11-03
---

{appName} is a free, open-source video meeting service. This policy explains what {appName} at {siteUrl} keeps about you, why, who else handles it, and for how long. {operator} runs this copy of {appName} and is responsible for your information. Anyone can run their own copy of {appName}, and each copy has its own policy.

**The short version:** {appName} keeps only what it needs to run your meetings. It has no ads and no tracking, doesn't record meetings, doesn't keep chat, and never sells your information.

## What {appName} keeps

### Your account

- Your **name**, **email address** and **picture**. The picture is an avatar {appName} draws for you, or your Google or GitHub photo if you choose it. That photo is then loaded from Google or GitHub.
- Your **password**, if you set one, stored only as a secure hash, never the password itself.
- Which **sign-in methods** you've connected. When you sign in with Google or GitHub, {appName} receives your name, email address and photo from them, and keeps the sign-in tokens they send, encrypted.
- Your **sign-in sessions**, with the IP address and browser each came from, so you stay signed in and sessions can be checked and ended.
- Whether the meetings you host **offer AI notes**: a yes-or-no setting in **Settings**, off until you turn it on.
- Whether you've **used the desktop app**: when you first signed in to it, so {appName} stops suggesting it on **Home** in your browsers.
- The **options you last scheduled a meeting with**, such as its length, passcode on or off, and waiting room, so your next meeting starts from them. Never its title, people or passcode.
- If you turn on **email reminders**: how long before a meeting they come, and the time zone their times are in. They go to your account's email address, before meetings you host or are invited to, and each one has the meeting's title, time, link, ID and passcode. To stop them, select the link at the foot of any reminder, or turn them off in **Settings**, under **Notifications**. {appName} keeps a short record of each reminder it sent (the meeting and its time), so none goes twice.
- If you **ask to host full meetings**: your request, the note you add, and the answer. This site's admins (the people who run it) see your name, your email and any note you send with a request, so they can decide; they can't see your meetings, notes or settings, or change your account.
- If an admin **approves your address** to host full meetings, before or after you sign up: the address, who approved it and when.

### Meetings you host

- Each meeting you create: its title, description, times and time zone, how it repeats, its meeting ID and passcode, and its settings, including whether AI notes start automatically.
- The **email addresses of people you invite** to a scheduled meeting, and of the people you name as **co-hosts** of a meeting, so you can edit them later and so they join as co-hosts. You see them, and so do the people invited to a scheduled meeting, on its page. They're deleted with the meeting.
- While a meeting runs: who's in it and their role, who's asking to join, raised hands, who's spotlighted, whether its host allows AI notes, whether they're on, and whether someone stopped them.

### Meetings you join

- **Who joined and left**, with the name and picture each person used and the times, so the host and the attendees with an account can see the meeting under **Previous**. The host can download it as a spreadsheet, which shows email addresses only of the people they invited.
- If you **ask to join** through the waiting room: your name, your picture and the host's answer.
- If a host **removes** you: a note of it, so you can't rejoin that meeting or read its shared notes.

### AI notes a host saves

AI notes are kept only when a host or co-host chooses to save them, or when the meeting's host has set it to share AI notes with its participants automatically, which everyone is told as AI notes go on: the notes, their transcript when it fits, which tool made them, and whether they're shared. Only whoever saved them and the meeting's host can read them, or, once they're shared, everyone with an account who was in that meeting.

### Google Calendar, if you connect it

- **Permission to manage events** on the Google calendars you own, which you give on Google's own screen. Signing in with Google never asks for it.
- The **tokens** for that permission, encrypted.
- The **ID of each event** {appName} creates, so it can update or cancel the event when you change the meeting.

{appName} uses this permission only to add, update and cancel the meetings you schedule. It never reads your other events.

### Google Calendar and Gmail, with the add-on

If you add {appName} to Google Calendar and Gmail (in **Settings**, under **Calendar**), {appName} puts your own copy of its add-on in your Google account, as an Apps Script project. For that it keeps:

- **Permission to create and update Apps Script projects**, which you give on Google's own screen, and the **tokens** for it, encrypted. {appName} uses it only to create your copy of the add-on and to keep it up to date. It never reads or changes your other projects.
- Your copy's **project ID**, the **ID of your Google account** it's in, and its **Google client ID**, so {appName} accepts it only from you.

For meetings you make with the add-on, {appName} keeps what it keeps for any meeting you schedule (its title, times, repeat and settings). For a meeting made from a Calendar event, it also keeps that **event's ID** and its **calendar's ID** (for your main calendar, that's your email address), to follow the event and link to it. It doesn't keep the event's guests: Google Calendar invites them.

The add-on runs on Google's servers, under your Google account. In Google Calendar it reads the event it's opened on, and, to keep meetings in step, the events that change in that calendar afterwards, telling {appName} only about the ones with {appName} meetings. In Gmail it only inserts the text you choose into the email you're writing, and never reads your mail. To know who you are, it sends {appName} a token from Google with your Google account's ID, which {appName} uses for that request and never keeps.

### People without an account

Guests get a cookie with a random ID and an avatar, so they're recognized when they come back. It holds no name or email. The name a guest types is kept in the meeting's records above, and remembered in their own browser for next time.

### Records that protect {appName}

To slow down password and passcode guessing, {appName} counts recent attempts. Sign-in limits keep the IP address. The other counters keep only a scrambled code made from it, not the address itself. Both are deleted after a day.

## What {appName} doesn't keep

- **Audio, video and screen sharing** go through Stream (below) to the other people in the meeting. They aren't recorded.
- **Chat messages and reactions** go straight to the people in the meeting and aren't stored. **Save chat** keeps a copy on your own device only.
- **AI notes while they're made.** AI notes can be turned on only in meetings whose host allows them in **Settings**, and turning that off stops any notes in progress. A host can set a meeting to start them automatically when they or a co-host joins; people about to join are told first. When AI notes go on, everyone sees it, and anyone can choose **Don't transcribe me**. Each person's speech is turned into text on their own device, so no audio leaves it for this, and only the text goes to the host taking notes. The transcript and notes stay in that host's browser tab until the host saves them (above) or closes the tab.
- **A host's AI key.** Hosts can make notes with their own key from an AI provider. The key stays in the host's browser and goes only to that provider. {appName}'s server never receives it.
- **Backgrounds and effects** are applied on your device before your video leaves it. Pictures and videos you add stay in your browser and are never uploaded.
- **Questions you ask Help's assistant** are answered on your device, by the model built into Chrome, and aren't sent anywhere.
- **Settings on your device**, such as your microphone and camera, time format and background, stay in your browser.

## How {appName} uses it

Only to run the service: to sign you in, connect your meetings, show your upcoming and past meetings, keep your Google Calendar up to date if you connect it, send the emails your account needs (like verifying your address or resetting your password) and the meeting reminders you turn on, and protect {appName} and the people using it from abuse. Nothing is used for advertising or profiling.

If you're in the European Economic Area, the United Kingdom or somewhere with similar laws, {appName} relies on these grounds:

- **To provide the service you asked for:** your account, your meetings and invitations, **Previous**, and AI notes a host saves.
- **Legitimate interests** in keeping {appName} secure and working: sign-in sessions, attempt counters and the hosting provider's logs.
- **Your consent**, to connect Google Calendar. You can withdraw it at any time by disconnecting.

## Cookies and your browser's storage

{appName} uses only the cookies it needs to work. There are no advertising or analytics cookies.

- **Sign-in** keeps you signed in, until you sign out or 7 days after you last use {appName}.
- **Sign-in helpers** check a sign-in with Google or GitHub, and keep a short-lived copy of your session so pages load faster. They last a few minutes.
- **`faceon_guest`** holds a guest's random ID and avatar, for 90 days after its last use.
- **`NEXT_LOCALE`** remembers the language you picked, for a year.
- **`sidebar_state`** remembers whether the sidebar is open, for a week.

Your browser also keeps some things for {appName} that aren't sent to its server. Your settings, a guest's name, backgrounds you add, a host's AI key, suggestions you've put away, and whether you've signed the desktop app in from this browser stay until you clear them. A meeting's passcode, and the transcript and notes a host is taking, go when you close the tab.

## The desktop app

If you use {appName}'s app for Mac or Windows, it keeps on your computer its settings (**Settings → Desktop app**), the size and place of its window, your reminder time, and its own sign-in, separate from your browser's. While it runs, it asks {appName} for your next day's meetings about every ten minutes, to remind you of them, and checks for a new version of itself every six hours. Signing the app in with Google or GitHub happens in your browser, which hands the app a code that works once, within ten minutes; {appName} keeps only a scrambled copy of that code, for those ten minutes.

## Who else handles your information

{appName} relies on these services. Each handles only what it needs, under its own privacy policy.

- **Vercel** hosts the website and runs its server. Like any web host, it logs requests, including IP addresses, to run and protect the site.
- **Neon** hosts the database.
- **Stream** runs the meetings. It carries audio, video, screen sharing, chat and reactions, and the text for AI notes on its way to the host taking them. It keeps the name and picture each person uses in meetings and a record of each call and who was in it, and it handles the technical details needed to connect you, such as your IP address and connection quality.
- **Resend** sends account emails, such as verifying your address or resetting your password, and the meeting reminder emails you turn on.
- **Have I Been Pwned** checks new passwords against ones exposed in data breaches. It receives only the first five characters of a scrambled code made from the password, which can't reveal it.
- **GitHub** hosts the desktop app's downloads and updates. It sees your IP address when the app checks for an update or you download it.
- **Google** and **GitHub**, if you sign in with them. **Google Calendar**, if you connect it: it receives the meetings you schedule, with your invitees' email addresses, and sends them the invitations. **Google Workspace**, if you use {appName}'s add-on: Google runs it, as described above.
- **Cloudflare Turnstile**, if {appName} turns it on, checks there's a person behind signing up, asking for a password reset or a new verification email, and joining as a guest for the first time. It sees your IP address and details of your browser and device while it checks.
- **Sentry**, if {appName} turns error reports on, receives a report when something breaks: the error, where in the code it happened, your browser and operating system, and the page's address with meeting IDs and passcodes taken out. Reports never include your name, email address, IP address, chat, notes or keys.
- **A host's AI provider** (OpenAI, Anthropic, Google, DeepSeek or OpenRouter), only when a host makes AI notes with their own key. The transcript goes from the host's browser straight to that provider, under the host's own account and the provider's terms.

{appName} doesn't sell your information or share it for advertising. Otherwise it's disclosed only when the law requires it, or when that's needed to protect someone's safety.

These services may handle your information in the United States and other countries, so it may leave the country where you live.

### Information from Google

{appName}'s use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. {appName} uses Google sign-in only for your account, Google Calendar only for the meetings you schedule, your Apps Script permission only for your copy of its add-on, and the add-on only for the meetings you add from Google Calendar and Gmail. It doesn't use information from Google for advertising and doesn't sell it, and nobody reads it unless you ask them to, security requires it, or the law does.

## How long it's kept

- **Your account**, until you delete it.
- **Sign-in sessions**, until you sign out or 7 days after you last use them. Expired sessions are deleted within a day.
- **Your personal room**, as long as your account.
- **Instant meetings** stop working after 30 days without use, and **scheduled meetings** 30 days after their last meeting. A series with no end date lasts a year past its latest use. A meeting is deleted, with its invitees, once nothing of it is left in **Previous**.
- **Who joined and left**, and **saved AI notes**, are deleted after 90 days. Whoever saved notes, or the meeting's host, can delete them sooner.
- **Waiting room requests and admission records** are deleted a week after the meeting. That someone was removed is kept as long as who joined (90 days).
- **Attempt counters and sign-in limits** are deleted after a day.
- **Records of reminder emails sent** are deleted two days after their meeting's start.
- **Your add-on's IDs**, until you remove it in **Settings** or remove Google from your account.
- **Requests to host full meetings** are deleted 90 days after they're answered. An approved address stays approved until an admin moves it back to demo meetings, or you delete your account.
- **A guest's cookie** expires 90 days after its last use.

When you **delete your account**, {appName} deletes your account, the meetings you host with their records, the AI notes you saved, your requests to host full meetings, and your address on the list of approved hosts. It ends any meeting you're hosting at that moment, asks Stream to delete your profile, and withdraws its access to your Google Calendar and Apps Script. Before it does, it cancels your upcoming meetings there, so Google tells the people you invited; past events stay in your calendar. Meetings other people host keep your name in who joined until that's deleted after 90 days.

## Your choices and rights

- **See and change** your name, picture and sign-in methods in **Settings**, under **Account**.
- **Disconnect Google Calendar**, or **remove {appName} from Google Calendar and Gmail**, in **Settings**, under **Calendar**.
- **Turn email reminders on or off** in **Settings**, under **Notifications**, or with the link in any reminder.
- **Delete your account** and its data at any time, under **Account**.
- **Download a copy** of your information at any time, under **Account**: **Download your data** gives you your account, the meetings you host, who came to your meetings, the AI notes you can read with their saved transcripts, and your requests to host, in formats other services can read. **Previous** also offers your meeting history on its own (**Download history**), and each meeting's attendance or AI notes. Downloads are made when you ask, and nothing is kept afterwards.
- **Ask** for anything else, such as a correction, or anything about this policy: {contact} {operator} answers within a month.

Depending on where you live, for example in the European Economic Area, the United Kingdom or California, you may also have the right to object to or limit how your information is used, to get it in a format you can take elsewhere, and to complain to a data protection authority. {appName} doesn't sell or share personal information, as California's privacy law defines those words.

## Children

{appName} isn't meant for children under 13, and they may not have an account. If you think a child under 13 has given {appName} their information, get in touch and it will be deleted: {contact}

## Security

Connections use HTTPS. Passwords are hashed, and the tokens Google and GitHub send are encrypted. Meeting links carry their passcode in a part of the address that browsers never send to servers. Only people a meeting lets in can connect to its call, and failed attempts are limited. No system is perfectly secure, which is one more reason {appName} keeps so little.

## Changes

When this policy changes, the new version appears here with a new date. Earlier versions are kept in {appName}'s code history.

## Contact

Questions about privacy: {contact}
