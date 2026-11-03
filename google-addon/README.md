# FaceOn for Google Calendar and Gmail

Add FaceOn meetings without leaving Google Calendar or Gmail, in your browser on a
computer:

- **Google Calendar:** choose **FaceOn meeting** under **Add video conferencing**, next to
  Google Meet. The event gets the join link, meeting ID and passcode. Move, rename or
  delete the event, and the meeting follows.
- **Gmail:** while writing an email, **Insert a FaceOn meeting** adds a new meeting or
  your personal room.
- **The side panel**, in both: start a meeting, join one by ID, and see your next meetings.

## Add it

You need a FaceOn account you sign in to with Google, or one with Google Calendar
connected in **Settings → Calendar**.

1. In FaceOn, open **Settings → Calendar** and select **Add FaceOn**. Google asks you to
   let FaceOn create an Apps Script project: that's where your own copy of the add-on
   lives, in your Google account.
2. Select **Open in Apps Script**, then **Deploy → Test deployments → Install**.
3. In Google Calendar, add a FaceOn meeting to an event. The first time, Google warns that
   the app isn't verified, because your copy isn't listed in Google's Marketplace. Select
   **Advanced → Go to FaceOn**, then **Allow**.

If Google says the Apps Script API is off, switch it on in
[Apps Script's settings](https://script.google.com/home/usersettings) and try again.

FaceOn keeps your copy up to date.

## What it can see

- **In Google Calendar:** the event you add a FaceOn meeting to, and later changes to
  events in that calendar, so meetings follow their events. It tells FaceOn only about the
  events with FaceOn meetings.
- **In Gmail:** only the text you choose to insert into the email you're writing. It never
  reads your mail.
- Your copy works only with your Google account. Anyone else adds their own.

## Remove it

1. In FaceOn, select **Remove** in **Settings → Calendar**.
2. In Apps Script, select **Deploy → Test deployments → Uninstall**. You can then delete
   the project from your [Apps Script projects](https://script.google.com/home).

More in Help: [Add FaceOn to Google Calendar and Gmail](https://joinfaceon.app/help/google-workspace).

Running your own FaceOn? Turning the add-on on is in
[DEPLOY.md](../DEPLOY.md#the-google-workspace-add-on-optional). Working on the add-on
itself is in [DEVELOPING.md](DEVELOPING.md).
