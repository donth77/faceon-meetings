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
- [ ] FaceOn's logo shows beside the meeting, once it's set (section 3).
- [ ] Look up whether Google's docs now let HTTP add-ons (the "alternate runtime") define
      conference solutions. If they do, the add-on could move into FaceOn's own server.

## 3. FaceOn's logo in Calendar

Calendar shows a FaceOn meeting with a plain camera icon until the conference has its
logo. Google takes that logo only from the add-on's Marketplace listing: its 32 × 32
application icon, at the address the listing gives it. `pnpm brand` writes the listing's
images to `google-addon/assets/`.

1. In the Google Cloud console, with FaceOn's project selected, open **APIs & Services →
   Library**, search for **Google Workspace Marketplace SDK**, and select **Enable**.
2. Open the SDK's **Store Listing**. Under **Graphic assets**, upload
   `google-addon/assets/icon-32.png` as the 32 × 32 application icon and
   `google-addon/assets/icon-128.png` as the 128 × 128 one, and
   `google-addon/assets/banner-220x140.png` as the card banner. Select **Save draft**.
   The listing doesn't need to be published for this.
3. Copy the uploaded 32 × 32 icon's address: right-click it and choose **Copy image
   address**. It starts with `https://lh3.googleusercontent.com/`.
4. Push the add-on with that address:

   ```sh
   FACEON_CONFERENCE_LOGO_URL="https://lh3.googleusercontent.com/…" pnpm addon:push
   ```

   In PowerShell: `$env:FACEON_CONFERENCE_LOGO_URL = "https://lh3.googleusercontent.com/…"; pnpm addon:push`.
   For releases from a `google-addon-v*` tag, set the repository variable
   `FACEON_CONFERENCE_LOGO_URL` to the same address.

FaceOn meetings added from then on show FaceOn's logo; ones added before keep the icon
Calendar stored with them.

The fuller checklist for each release, including a Google Workspace account, is
[QA.md](QA.md).
