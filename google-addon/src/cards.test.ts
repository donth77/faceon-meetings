import { describe, expect, it } from "vitest";

import type { AddonHome } from "../../src/lib/addon/google/types";
import {
  composeCard,
  errorCard,
  escapeText,
  homeCard,
  meetingCard,
  meetingIdFrom,
  signInCard,
  type CardModel,
  type Widget,
} from "./cards";
import { translator } from "./text";

const t = translator(
  {
    en: {
      home: {
        open: "Open {appName}",
        start: "Start a meeting",
        startHint: "Hint",
        joinTitle: "Join a meeting",
        meetingId: "Meeting ID",
        meetingIdHint: "10 digits",
        join: "Join",
        next: "Next meetings",
        nothingNext: "Nothing",
        personalRoom: "Your personal room",
        showInvitation: "Show invitation",
        settings: "Settings",
        badMeetingId: "Bad",
      },
      meeting: {
        ready: "Ready",
        invitation: "Invitation",
        invitationHint: "Select",
      },
      signIn: {
        title: "Sign in to {appName}",
        body: "Body",
        button: "Sign in",
        emailTitle: "Email?",
        emailBody: "Connect",
        emailButton: "Open Settings",
      },
      errors: {
        unreachable: "Unreachable",
        tryAgain: "Try again",
        dailyLimit: "Limit",
        limits: "About limits",
        notAvailable: "Not set up",
      },
      compose: {
        title: "Insert",
        which: "Meeting",
        new: "A new meeting",
        personalRoom: "My personal room",
        meetingTitle: "Title",
        insert: "Insert",
      },
    },
  },
  "en-US",
  "FaceOn",
);

const room = {
  code: "2603874721",
  meetingId: "260 387 4721",
  joinUrl: "https://faceon.test/j/2603874721#pwd=H5YY83",
  passcode: "H5YY83",
  title: "Ada’s meeting",
  invitation: "Ada is inviting you…",
};
const home: AddonHome = {
  name: "Ada",
  personalRoom: room,
  upcoming: [
    {
      code: "8633885718",
      title: "Q&A <draft>",
      when: "Wed, Nov 4 · 6:00 – 6:30 PM",
      joinUrl: "https://faceon.test/j/8633885718#pwd=9YJRBH",
    },
  ],
};
const widgets = (card: CardModel): Widget[] =>
  card.sections.flatMap((s) => s.widgets);
const buttons = (card: CardModel) =>
  widgets(card).flatMap((w) =>
    w.kind === "buttons"
      ? w.buttons
      : w.kind === "item" && w.button
        ? [w.button]
        : [],
  );

describe("homeCard", () => {
  it("offers start, join by ID, the next meetings and the personal room", () => {
    const card = homeCard(t, home, "https://faceon.test");
    expect(card.title).toBe("Open FaceOn");
    expect(card.sections.map((s) => s.header)).toEqual([
      undefined,
      "Join a meeting",
      "Next meetings",
      "Your personal room",
      undefined,
    ]);
    const next = widgets(card).find(
      (w) => w.kind === "item" && w.top?.startsWith("Wed"),
    );
    expect(next).toMatchObject({
      text: "Q&amp;A &lt;draft&gt;",
      button: { action: { kind: "open", url: home.upcoming[0]?.joinUrl } },
    });
    expect(buttons(card).map((b) => b.action)).toContainEqual({
      kind: "run",
      handler: "onShowInvitation",
      params: { kind: "personalRoom" },
    });
    expect(buttons(card).map((b) => b.action)).toContainEqual({
      kind: "open",
      url: "https://faceon.test/settings/calendar",
      reloadOnClose: false,
    });
  });

  it("says when nothing is scheduled", () => {
    const card = homeCard(t, { ...home, upcoming: [] }, "https://faceon.test");
    expect(widgets(card)).toContainEqual({ kind: "text", text: "Nothing" });
  });
});

describe("the other cards", () => {
  it("show a meeting with Join and its invitation to copy", () => {
    const card = meetingCard(t, room);
    expect(card.title).toBe("Ada’s meeting");
    expect(widgets(card)).toContainEqual(
      expect.objectContaining({
        kind: "input",
        value: room.invitation,
        multiline: true,
      }),
    );
    expect(buttons(card)[0]?.action).toEqual({
      kind: "open",
      url: room.joinUrl,
      reloadOnClose: false,
    });
  });

  it("send people who aren't known to sign in, coming back to a reloaded card", () => {
    const card = signInCard(
      t,
      "https://faceon.test/sign-in?next=x",
      "https://faceon.test",
    );
    expect(buttons(card).map((b) => b.action)).toEqual([
      {
        kind: "open",
        url: "https://faceon.test/sign-in?next=x",
        reloadOnClose: true,
      },
      {
        kind: "open",
        url: "https://faceon.test/settings/calendar",
        reloadOnClose: true,
      },
    ]);
  });

  it("explain errors: limits with a link, a passing problem with Try again", () => {
    const limit = errorCard(t, {
      code: "PERMANENT",
      reason: "dailyLimit",
      link: "https://faceon.test/help/meeting-limits",
    });
    expect(widgets(limit)[0]).toEqual({ kind: "text", text: "Limit" });
    expect(buttons(limit)[0]?.action).toMatchObject({
      url: "https://faceon.test/help/meeting-limits",
    });
    expect(buttons(errorCard(t, { code: "TEMPORARY" }))[0]?.action).toEqual({
      kind: "run",
      handler: "onReloadHome",
    });
    const off = errorCard(t, { code: "NOT_AVAILABLE" });
    expect(widgets(off)).toEqual([{ kind: "text", text: "Not set up" }]);
  });

  it("let Gmail insert a new meeting or the personal room", () => {
    const card = composeCard(t);
    expect(widgets(card)[0]).toMatchObject({
      kind: "choice",
      name: "which",
      options: [
        { value: "new", selected: true },
        { value: "personalRoom", selected: false },
      ],
    });
    expect(buttons(card)[0]?.action).toEqual({
      kind: "run",
      handler: "onComposeInsert",
    });
  });
});

describe("meetingIdFrom and escapeText", () => {
  it("reads a meeting ID with spaces or dashes, and nothing else", () => {
    expect(meetingIdFrom(" 123 456 7890 ")).toBe("1234567890");
    expect(meetingIdFrom("123-456-7890")).toBe("1234567890");
    expect(meetingIdFrom("0123456789")).toBeNull();
    expect(meetingIdFrom("12345")).toBeNull();
  });

  it("keeps people's text as text", () => {
    expect(escapeText("<b>&")).toBe("&lt;b&gt;&amp;");
  });
});
