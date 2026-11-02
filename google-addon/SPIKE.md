# Setting up the add-on, and what to check first

These are the first install's steps and checks (the plan calls it the spike). Run the
commands from the repository's root; in Claude Code, prefix each with `!`. The add-on
talks to the FaceOn at `FACEON_URL` (https://joinfaceon.app unless you set it), from
Google's servers, so that copy must be reachable on the internet.

## 1. Set up (once, about 15 minutes)

1. Turn on the Apps Script API for your Google account: open
   <https://script.google.com/home/usersettings> and switch **Google Apps Script API** on.
2. Log clasp in to the same Google account (it opens your browser):

   ```sh
   pnpm addon:login
   ```

3. Create the add-on's Apps Script project. This writes `google-addon/.clasp.json`
   (ignored by git) with its script ID:

   ```sh
   cd google-addon && pnpm dlx @google/clasp@3.4.1 create-script --type standalone --title "FaceOn" --rootDir dist && cd ..
   ```

4. Link it to FaceOn's Google Cloud project, the one sign-in and Calendar sync use, so one
   consent screen covers everything:
   - In the Google Cloud console, copy that project's **project number** from its
     dashboard.
   - Open the Apps Script project (<https://script.google.com>) and go to **Project
     Settings → Google Cloud Platform (GCP) Project → Change project**. Paste the number
     and select **Set project**.
5. Build and push the add-on:

   ```sh
   pnpm addon:push
   ```

6. Install it for yourself: in the Apps Script editor, **Deploy → Test deployments →
   Install**.
7. Let FaceOn accept it. In Google Calendar on the web, open any event and choose
   **Add video conferencing ▾ → FaceOn meeting**. This first time Calendar shows an error,
   because FaceOn doesn't know the add-on yet. In the Apps Script editor, **Executions**
   shows that run's log line, like `{"aud":"…apps.googleusercontent.com","sub":"…"}`:
   - Put `aud` into `GOOGLE_ADDON_CLIENT_ID` in Vercel (Production), and redeploy.
   - `sub` is your Google account's ID. FaceOn finds your account by it, so you need to
     have signed in to FaceOn with this Google account, or connected it in Settings →
     Calendar.

## 2. Check

- [ ] **FaceOn meeting** appears under **Add video conferencing ▾**, next to Google Meet.
- [ ] On a new event, choosing it adds the join link, the meeting ID and the passcode.
      Save the event: within a few minutes FaceOn's Upcoming shows the meeting at the
      event's time (the add-on's Calendar trigger sends it).
- [ ] FaceOn's page for that meeting says it was made in Google Calendar, and **Open in
      Google Calendar** opens the event.
- [ ] Move or rename the event: FaceOn follows. Delete it: the meeting is cancelled.
- [ ] A weekly event gets one meeting ID for every week. Move one week's meeting, and
      delete another: FaceOn shows the first moved and the second gone.
- [ ] The sidebar, in Calendar and in Gmail: **Start a meeting**, **Join** with a meeting
      ID, the next meetings, your personal room's **Show invitation**, and **Settings**.
- [ ] In Gmail, a new email's add-on menu: **Insert a FaceOn meeting**, for a new
      meeting (with a title) and for your personal room.
- [ ] With a Google account FaceOn doesn't know, Calendar's error links to FaceOn's
      sign-in, and the sidebar says **Sign in to FaceOn**.
- [ ] On a phone, the event's join details show in the Google Calendar app. Note
      whether the app offers **FaceOn meeting** when you add conferencing there.
- [ ] If Calendar shows no FaceOn logo: Google wants the conference logo hosted on
      Google. Set `FACEON_CONFERENCE_LOGO_URL` to one (for example, an image uploaded
      with the Marketplace listing) and push again.
- [ ] Look up whether Google's docs now let HTTP add-ons (the "alternate runtime") define
      conference solutions. If they do, the add-on could move into FaceOn's own server.

The fuller checklist for each release, including a Google Workspace account, is
[QA.md](QA.md).
