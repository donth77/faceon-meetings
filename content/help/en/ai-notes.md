---
title: AI notes
summary: A summary, action items and decisions from what's said, made in your browser.
category: hosting
order: 5
---

AI notes turn what's said in a meeting into a short summary, a list of action items (with who will do each and by when, when that's clear) and the decisions made. They're off unless the meeting's host allows them and a host starts them, everyone can see when they're on, and nothing is saved unless the notetaker chooses to.

## Allow them in your meetings

AI notes are off for every account to start. To use them in meetings you host, go to **Settings**, then **AI notes**, and turn on **AI notes in meetings you host**. In a meeting you host, **More**, then **AI notes** has a button that takes you there.

This choice is kept with your account, so it covers your co-hosts as well: while it's off, nobody can start AI notes in your meetings. Turning it off also stops any that are on in a meeting you're hosting now.

## Turn them on

Hosts and co-hosts select **More**, then **AI notes**, then **Start AI notes**. Each meeting starts with them off. AI notes aren't available in demo meetings, or in meetings whose host hasn't allowed them.

Whoever starts them is the notetaker: the transcript collects in their browser, and the notes are made there. Select **Stop AI notes** to end them for everyone. They also stop when the notetaker leaves.

## Start them automatically

Once your meetings allow AI notes, a meeting can start them by itself: turn on **Start AI notes automatically** when you schedule it, on the meeting's page, on your **Personal room** page, or in the meeting (**Participants**, then **⋯**). From then on, AI notes start as soon as you or a co-host joins, with the same message for everyone, and people about to join are told beforehand.

They start in the browser of whoever joins, as long as it can make notes (see How the notes are made, below). If it can't, they don't start, and {appName} says why, with a way to **Settings**. Once someone selects **Stop AI notes**, they stay off for the rest of that meeting, even if someone rejoins.

## What everyone sees

- **AI notes on** at the top of the meeting, and a message saying who turned them on.
- People about to join see the same note before they join, or, in a meeting that starts AI notes automatically, that they'll start.
- To stay out of the notes, select **AI notes on**, then turn on **Don't transcribe me**. From then on, what you say isn't transcribed, and the notetaker sees that you chose this.

## How speech becomes text

Each person's browser turns what _they_ say into text, on their own device, and sends only the text to the notetaker. Audio never leaves anyone's device for this, and nothing is transcribed while you're muted.

This works in Chrome on a computer. The first time, Chrome may need a one-time download to transcribe your language: select **Download** when it asks. Where a browser can't transcribe on the device (Safari, Firefox and some phones), that person's words aren't in the notes, and the notetaker sees who's missing.

## How the notes are made

When the notetaker stops AI notes, or leaves, the notes are made from the transcript. Choose how in **Settings**, then **AI notes**:

- **On this computer**: Chrome's built-in AI makes the notes on the notetaker's own computer. It's free, and nothing leaves the computer. The first time, Chrome downloads its AI, which can take a few minutes. It needs a recent Chrome on a computer with enough memory and disk space, and writes notes in English, Spanish or Japanese (in English for other languages).
- **Your own AI key**: your AI provider (OpenAI, Anthropic, Google, DeepSeek or OpenRouter) makes the notes, with a key from your account with them. Your browser sends the transcript straight to the provider, and they bill you. Select **Test key** to check that it works.

> **Your key stays in your browser.** {appName} never receives or stores it. Some providers' free plans may use what you send to improve their products, so check your provider's terms before using a free key for private meetings.

## After the meeting

The notes show in the **AI notes** panel, and after you leave the meeting. Select **Copy** to copy them, or **Download .md** to save them, with the transcript, as a Markdown file. **Make again** makes them again, for example another way.

Until you save them, the transcript and the notes stay only in that browser tab: closing the tab forgets them. Select **Delete notes and transcript** to remove them sooner.

## Save and share them

If you're signed in, you can keep the notes with the meeting:

- **Save to meeting**: only you and the meeting's host can see them.
- **Share with participants**: everyone who was in the meeting with an account can see them too.

A host can set a meeting to **Share AI notes with participants automatically**: on the schedule form, the meeting's page, the personal room's page, or in the meeting under **Participants** › **⋯**. Then notes are saved and shared as soon as they're made, without anyone selecting **Save**, and everyone is told when AI notes go on, before they speak. Whoever saved them, or the host, can still **Stop sharing** or delete them. Notes made by a co-host without an account can't be saved, so they say so; copy or download them to share them.

Saved notes are under **Previous**: select the meeting's **View details**, then **View AI notes**. There, **Stop sharing** or **Delete notes** if you saved them or host the meeting. The transcript is saved with them when it fits (up to about 200 KB in all). Saved notes are deleted after 90 days, or with the meeting.
