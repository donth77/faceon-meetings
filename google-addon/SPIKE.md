# Add-on spike: what to check once it's installed

The spike is the add-on's first build: **FaceOn meeting** appears in Google Calendar's
**Add video conferencing** menu and adds a stand-in meeting (ID `spike-0000`). It proves
how Google calls the add-on before the real meetings are wired in.

## 1. Set up (once, about 10 minutes)

Run the commands from the repository's root. In Claude Code, prefix each with `!`.

1. Turn on the Apps Script API for your Google account: open
   <https://script.google.com/home/usersettings> and switch **Google Apps Script API** on.
2. Log clasp in to the same Google account (it opens your browser):

   ```sh
   pnpm addon:login
   ```

3. Create the add-on's Apps Script project. This writes `google-addon/.clasp.json`
   (ignored by git) with the new project's script ID:

   ```sh
   cd google-addon && pnpm dlx @google/clasp@3.4.1 create --type standalone --title "FaceOn" --rootDir dist && cd ..
   ```

4. Link it to FaceOn's Google Cloud project, the one sign-in and Calendar sync use, so one
   consent screen covers everything:
   - In the Google Cloud console, open that project's dashboard and copy its **project
     number**.
   - Open the Apps Script project (<https://script.google.com>, or
     `cd google-addon && pnpm dlx @google/clasp@3.4.1 open-script`), then **Project
     Settings → Google Cloud Platform (GCP) Project → Change project**, paste the number
     and select **Set project**.
5. Build and push the add-on:

   ```sh
   pnpm addon:push
   ```

6. Install it for yourself: in the Apps Script editor, **Deploy → Test deployments →
   Install**. Google asks you to allow the add-on's permissions the first time you use it.

## 2. Check

- [ ] In Google Calendar on the web, open an event and select **Add video conferencing ▾**.
      **FaceOn meeting** is there, next to Google Meet.
- [ ] Choosing it adds the stand-in details to the event (meeting ID `spike-0000`, and
      "FaceOn add-on test: this isn't a real meeting yet.").
- [ ] In the Apps Script editor, **Executions** shows the `onCreateConference` run with a
      line like `{"aud":"…","sub":"…","iss":"https://accounts.google.com",…}`:
  - `aud` is the add-on's OAuth client ID. It goes into `GOOGLE_ADDON_CLIENT_ID` (Vercel
    and `.env.local`), so FaceOn's API accepts the add-on's tokens.
  - `sub` is your Google account's ID. FaceOn finds your account by it, so it must match
    the Google sign-in FaceOn already knows (send it to whoever maintains your copy to
    compare).
- [ ] Save an event titled `auth-test`, then add **FaceOn meeting** to it. Calendar shows
      FaceOn's sign-in error, and its link opens FaceOn's sign-in page.
- [ ] On a phone, open one of those events in the Google Calendar app: the join details
      show. Note whether the app offers **FaceOn meeting** when you add conferencing there.
- [ ] Later, with a Google Workspace account: the same checks.
- [ ] Look up whether Google's docs now let HTTP add-ons (the "alternate runtime") define
      conference solutions. If they do, the add-on could move into FaceOn's own server.

When these pass, the real meetings (the next build) replace the stand-in.
