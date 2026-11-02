# Add-on QA checklist

Google's own pages can't be driven by tests, so check these by hand before each
`google-addon-v*` release: on a personal Google account, and on a Google Workspace
account once there is one. The unit tests cover the cards, the conference data, reading
Calendar's changes and the API's checks.

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
- [ ] A Google account FaceOn doesn't know: **Sign in to FaceOn**, and "Signed up with
      email?" with **Open Settings**. After signing in (or connecting Google Calendar),
      the sidebar reloads signed in.
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
- [ ] An admin installs it for the organization (a private listing, or the public one).
