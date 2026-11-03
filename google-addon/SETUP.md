# Working on the add-on

People don't set this add-on up by hand: they add their own copy from FaceOn's
**Settings → Calendar**, and FaceOn keeps it up to date ([DEPLOY.md](../DEPLOY.md#the-google-workspace-add-on-optional)).
This page is for working on the add-on itself. Run the commands from the repository's root.

## How FaceOn makes each copy

- `node google-addon/build.mjs --bundle` bundles the add-on into
  `src/lib/addon/google/bundle.generated.json`: one script, the manifest template
  (`appsscript.json`) and a version, the same for every copy. `pnpm dev`, `build`, `test`
  and `typecheck` make it first; it isn't committed, and Vercel builds every change here.
- **Add** in Settings → Calendar asks Google for the `script.projects` scope, then
  `src/lib/addon/google/setup.ts` creates an Apps Script project in the person's account
  through the Apps Script API (`apps-script.ts`) and writes two files into it
  (`content.ts`): the manifest, filled in for this FaceOn, and `Code.js`, whose first line
  is the copy's settings (FaceOn's address and name, the version, and a one-time connect
  token), ahead of the bundle.
- The person installs it in Google's Apps Script editor (**Deploy → Test deployments →
  Install**). Outside the Marketplace there's no other way to install an add-on.
- Each request carries the person's Google identity token. Its audience is their copy's
  own OAuth client, which FaceOn learns from the copy's first request, the one with the
  connect token. After that, FaceOn accepts that client only from the Google account the
  copy was made in (`setup-rules.ts`, `ownerOf`).
- Each request also says the copy's version. When it's behind, FaceOn writes the current
  build into the project after answering, and the next use runs it: a test deployment
  always runs the project's latest code.

## Try your changes

You push your own build to a copy you made in FaceOn. FaceOn's servers can't call
`localhost`, so use a FaceOn on the internet (production, or a preview on `https://`).

1. In that FaceOn, add the add-on in Settings → Calendar, install it, and use it once in
   Google Calendar, so it connects.
2. Turn on the Apps Script API for your Google account, if it isn't:
   <https://script.google.com/home/usersettings>.
3. Log clasp in to the same Google account (it opens your browser):

   ```sh
   pnpm addon:login
   ```

4. Copy `google-addon/.clasp.json.example` to `google-addon/.clasp.json` (git ignores it)
   and paste in the script ID: it's in the address **Open in Apps Script** opens,
   `https://script.google.com/home/projects/<script ID>/edit`.
5. Build and push, for that FaceOn:

   ```sh
   FACEON_URL=https://faceon.example.com pnpm addon:push
   ```

   In PowerShell: `$env:FACEON_URL = "https://faceon.example.com"; pnpm addon:push`.

Your build says it's version `dev`, so FaceOn leaves it alone rather than update it. To go
back to FaceOn's own build, remove the add-on in Settings → Calendar, then add it again.

## Check

- [ ] **FaceOn meeting** appears under **Add video conferencing ▾**, next to Google Meet,
      with FaceOn's logo.
- [ ] On a new event, choosing it adds the join link, the meeting ID and the passcode.
      Save the event: within a few minutes FaceOn's Upcoming shows the meeting at the
      event's time (the add-on's Calendar trigger sends it).
- [ ] FaceOn's page for that meeting says it was made in Google Calendar, and **Open in
      Google Calendar** opens the event.
- [ ] Move or rename the event: FaceOn follows. Delete it: the meeting is cancelled.
- [ ] A weekly event gets one meeting ID for every week. Move one week's meeting, and
      delete another: FaceOn shows the first moved and the second gone.
- [ ] The side panel, in Calendar and in Gmail: **Start a meeting**, **Join** with a
      meeting ID, the next meetings, your personal room's **Show invitation**, and
      **Settings**.
- [ ] In Gmail, a new email's add-on menu: **Insert a FaceOn meeting**, for a new
      meeting (with a title) and for your personal room.
- [ ] Someone else using your copy (shared with them in Apps Script): Calendar's error
      and the side panel send them to FaceOn's Settings → Calendar to add their own.
- [ ] On a phone, the event's join details show in the Google Calendar app.

The fuller checklist, before a change goes out, is [QA.md](QA.md).

## Your own logo in Calendar

Calendar shows a conference's logo only from Google's own servers (Google's manifest docs:
it "must be hosted on Google infrastructure"), so FaceOn's address won't do. A copy named
FaceOn uses FaceOn's logo, which Google hosts. A copy with another name gets its own like
this; it doesn't need to be listed:

1. In the Google Cloud console, with your project selected, open **APIs & Services →
   Library**, search for **Google Workspace Marketplace SDK**, and select **Enable**.
2. Open the SDK's **Store Listing**. Under **Graphic assets**, upload
   `google-addon/assets/icon-128.png` (written by `pnpm brand`) as the 128 × 128
   application icon, and select **Save draft**. Don't publish it.
3. Right-click the uploaded icon, choose **Copy image address** (it starts with
   `https://lh3.googleusercontent.com/`), and set `GOOGLE_ADDON_CONFERENCE_LOGO_URL` to it
   where FaceOn is hosted. Each copy gets it with its next update; meetings added before
   keep the icon Calendar stored with them.

## Google's alternate runtime

Google's add-ons can also run as HTTP endpoints on your own server, which would put the
add-on inside FaceOn itself. Google documents conferencing add-ons only for Apps Script, so
this one stays an Apps Script project; it's worth looking again now and then.
