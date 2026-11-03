---
title: "Add {appName} to Google Calendar and Gmail"
summary: Choose {appName} meeting from Google Calendar's Add video conferencing, and put a meeting in an email in Gmail.
category: hosting
order: 4
---

{appName}'s add-on for Google Workspace puts {appName} where you already plan meetings: Google Calendar and Gmail, in your browser on a computer. You add your own copy of it to your Google account, from {appName}'s Settings.

## Add it

1. In {appName}, open **Settings → Calendar** and select **Add {appName}** under **{appName} in Google Calendar and Gmail**.
2. Google asks you to let {appName} create and update Apps Script projects in your account. {appName} uses this only to put its add-on there and keep it up to date.
3. Select **Open in Apps Script**, then **Deploy → Test deployments → Install**. Google installs an add-on that isn't in its Marketplace only this way, so this step is yours to do, once.
4. Open Google Calendar. The first time you use {appName} there, Google asks you to allow it and warns that it isn't verified. That's because it's your own copy, not one listed in Google's Marketplace: select **Advanced**, then **Go to {appName}**, then **Allow**.

If Google says the Apps Script API is off, open [Apps Script's settings](https://script.google.com/home/usersettings), switch **Google Apps Script API** on, and try again. If your Google account belongs to a school or company, its admin may not allow Apps Script.

Your copy works only with your Google account: if you share it with someone, it won't work for them. They can add their own.

## In Google Calendar: Add video conferencing

1. Create or open an event.
2. Select **Add video conferencing ▾** and choose **{appName} meeting**.

The event gets a **Join** link, the meeting ID and the passcode, so everyone you invite has them, and Google Calendar sends the invitations as usual.

Afterwards, {appName} follows the event: move it or rename it and the meeting moves with it, and delete it to cancel the meeting. A repeating event gets one meeting ID for every time it happens, and moving or removing one of them does the same in {appName}. Changes reach {appName} within a few minutes.

{appName}'s page for a meeting made this way says it came from Google Calendar and opens the event. Change its time there; its {appName} settings, such as the passcode, the waiting room and AI notes, still change on {appName}'s page. If you've also connected Google Calendar in **Settings → Calendar**, these meetings don't get a second event.

## The side panel in Calendar and Gmail

Select the {appName} icon on the right of Google Calendar or Gmail to:

- **Start a meeting** with its own link, to join now or send.
- **Join** a meeting by its 10-digit meeting ID.
- See your **next meetings** for the week, each with **Join**.
- Show your **personal room**'s invitation, to copy and send.
- Open **Settings**.

## In Gmail: put a meeting in an email

While writing an email, open the add-ons menu at the bottom of the window and choose **Insert a {appName} meeting**: a new meeting, with a title if you like, or your personal room. The invitation goes in where your cursor is.

## What it can see

- **In Google Calendar,** the event you add a {appName} meeting to, while you have it open. To keep meetings in step, it also looks at the events that change in that calendar afterwards, and tells {appName} only about the ones with {appName} meetings.
- **In Gmail,** only the text you choose to insert, into the email you're writing. It never reads your mail.

Meetings made through the add-on count towards your meeting limits like any other ([Meeting limits](/help/meeting-limits)).

## Updates and removing it

{appName} keeps your copy up to date by itself. If Google stops letting it, **Settings → Calendar** asks you to select **Update the add-on** and allow it again.

To remove it, select **Remove** in **Settings → Calendar**. Then, to take it out of Google too, open it in Apps Script and select **Deploy → Test deployments → Uninstall**. You can also delete the project from your [Apps Script projects](https://script.google.com/home).

## On a phone

Google's phone apps don't run add-ons, but the join details are part of the event: open it in the Google Calendar app and select the link to join.
