# Add-on QA checklist

Google's own pages can't be driven by tests, so check these by hand before a change to
the add-on goes out (FaceOn updates everyone's copy the next time they use it): on a
personal Google account, and on a Google Workspace account once there is one. The unit
tests cover the cards, the conference data, reading Calendar's changes, the API's checks,
connecting a copy and the Apps Script API calls; the end-to-end tests cover Settings →
Calendar.

## Adding it (Settings → Calendar)

- [ ] **Add FaceOn**: Google's consent screen asks to create and update Apps Script
      projects; back in Settings, **Open in Apps Script** and the install steps.
- [ ] In Apps Script: **Deploy → Test deployments → Install**. The first use in Calendar
      asks to allow it, with Google's "isn't verified" warning, and **Advanced → Go to
      FaceOn** gets through.
- [ ] Back in Settings (switch to its tab): "FaceOn is in your Google Calendar and Gmail".
- [ ] With your Apps Script API setting off (script.google.com/home/usersettings): Settings
      says so, links there, and **Try again** works once it's on.
- [ ] Declining on Google's screen: Settings says it wasn't added, with **Try again**.
- [ ] After a change to the add-on is deployed: the next use updates the copy (the
      project's code in Apps Script changes).
- [ ] **Remove**: Settings says how to uninstall it in Apps Script, and the copy's side
      panel then sends you to Settings to add it again.
- [ ] From the desktop app: **Add FaceOn** finishes in the browser, and the app's
      Settings shows it added.

## Calendar: FaceOn meeting

- [ ] A new event: **Add video conferencing ▾ → FaceOn meeting** adds the join link (the
      passcode in it), the meeting ID, the passcode and a short note.
- [ ] A saved event: the same, and FaceOn's meeting has the event's title and time.
- [ ] Choosing FaceOn again on the same event gives the same meeting ID.
- [ ] Moving or renaming the event: FaceOn follows within a few minutes.
- [ ] Repeats FaceOn follows: daily, weekly on several days, every 2 weeks, monthly on a
      date, on the second Tuesday, on the last Friday, until a date, and for a number of
      times. One meeting ID for all.
- [ ] A repeat FaceOn can't say (for example, the second-to-last weekday of the month):
      one meeting ID with no fixed time, and the link still works.
- [ ] Moving one meeting of a series, and deleting another: FaceOn shows both.
- [ ] Deleting the event, taking FaceOn off it, or switching it to Google Meet: the
      FaceOn meeting is cancelled.
- [ ] With Calendar sync connected in FaceOn (Settings → Calendar): no second event.
- [ ] FaceOn's page for the meeting: "Made in Google Calendar", **Open in Google
      Calendar**, no Edit or Delete; its settings (passcode, waiting room, AI notes)
      still change there.
- [ ] A host who has made as many meetings as FaceOn allows in a day: Calendar shows
      Google's error, and the sidebar's Start a meeting links to Meeting limits.
- [ ] An invitee: they see the join details, and changes on their copy of the event
      don't touch the meeting.

## The sidebar (Calendar and Gmail)

- [ ] Signed in: **Start a meeting** shows a new meeting with Join and its invitation,
      selectable to copy.
- [ ] **Join** with a meeting ID: 10 digits, with or without spaces or dashes, opens it;
      anything else says what a meeting ID looks like.
- [ ] **Next meetings** lists the next week's (up to three) in your time zone and
      language, each with Join; with none, it says so.
- [ ] **Your personal room**: its ID, Join, and **Show invitation**.
- [ ] **Settings** opens FaceOn's Settings → Calendar; Calendar's own settings → FaceOn
      opens it too.
- [ ] Your copy used from another Google account (shared with it in Apps Script): "FaceOn
      isn't connected", with **Open Settings**, and Calendar's error leads there too.
- [ ] FaceOn unreachable: "can't be reached right now" with **Try again**.

## Gmail: compose

- [ ] **Insert a FaceOn meeting**: a new meeting with a title, a new meeting without
      one, and your personal room. The invitation goes in where the cursor is.
- [ ] The add-on never asks to read the email (draft access: none).

## Phones and other places

- [ ] Google Calendar's phone apps show the join details and open the link.
- [ ] Whether **FaceOn meeting** can be added from a phone (Google may not offer it).

## A Google Workspace account

- [ ] Everything above.
- [ ] With Apps Script turned off by the organization's admin: Settings says so plainly.
