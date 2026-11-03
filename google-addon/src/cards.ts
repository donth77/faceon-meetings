/**
 * The add-on's cards, as plain values: what each says and does, built from FaceOn's
 * answers and tested without Apps Script. render.ts turns them into CardService cards,
 * within what cards can do (sections, text, labelled items, text inputs, radio choices,
 * and filled, outlined or text buttons).
 */
import type { AddonHome, AddonMeeting } from "../../src/lib/addon/google/types";
import type { AddonError } from "./api-errors";
import type { HandlerName } from "./handlers";
import type { Translate } from "./text";

export type Action =
  | { kind: "open"; url: string; reloadOnClose?: boolean }
  | { kind: "run"; handler: HandlerName; params?: Record<string, string> };

export type Button = {
  text: string;
  action: Action;
  style?: "filled" | "outlined" | "text";
};

export type Widget =
  | { kind: "text"; text: string }
  | {
      kind: "item";
      top?: string;
      text: string;
      bottom?: string;
      button?: Button;
    }
  | { kind: "buttons"; buttons: Button[] }
  | {
      kind: "input";
      name: string;
      label: string;
      hint?: string;
      value?: string;
      multiline?: boolean;
    }
  | {
      kind: "choice";
      name: string;
      label: string;
      options: { text: string; value: string; selected: boolean }[];
    };

export type Section = { header?: string; widgets: Widget[] };
export type CardModel = { name: string; title: string; sections: Section[] };

/** Cards read their text as a little HTML: people's titles must show as they are. */
export function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const open = (url: string, reloadOnClose = false): Action => ({
  kind: "open",
  url,
  reloadOnClose,
});

/** The sidebar, signed in: start, join by ID, the next meetings and the personal room. */
export function homeCard(
  t: Translate,
  home: AddonHome,
  site: string,
): CardModel {
  const room = home.personalRoom;
  return {
    name: "home",
    title: t("home.open"),
    sections: [
      {
        widgets: [
          { kind: "text", text: escapeText(t("home.startHint")) },
          {
            kind: "buttons",
            buttons: [
              {
                text: t("home.start"),
                style: "filled",
                action: { kind: "run", handler: "onStartMeeting" },
              },
            ],
          },
        ],
      },
      {
        header: t("home.joinTitle"),
        widgets: [
          {
            kind: "input",
            name: "meetingId",
            label: t("home.meetingId"),
            hint: t("home.meetingIdHint"),
          },
          {
            kind: "buttons",
            buttons: [
              {
                text: t("home.join"),
                style: "outlined",
                action: { kind: "run", handler: "onJoinById" },
              },
            ],
          },
        ],
      },
      {
        header: t("home.next"),
        widgets:
          home.upcoming.length === 0
            ? [{ kind: "text", text: escapeText(t("home.nothingNext")) }]
            : home.upcoming.map((meeting) => ({
                kind: "item" as const,
                top: escapeText(meeting.when),
                text: escapeText(meeting.title),
                button: { text: t("home.join"), action: open(meeting.joinUrl) },
              })),
      },
      {
        header: t("home.personalRoom"),
        widgets: [
          {
            kind: "item",
            top: t("home.meetingId"),
            text: escapeText(room.meetingId),
            button: { text: t("home.join"), action: open(room.joinUrl) },
          },
          {
            kind: "buttons",
            buttons: [
              {
                text: t("home.showInvitation"),
                style: "text",
                action: {
                  kind: "run",
                  handler: "onShowInvitation",
                  params: { kind: "personalRoom" },
                },
              },
            ],
          },
        ],
      },
      {
        widgets: [
          {
            kind: "buttons",
            buttons: [
              {
                text: t("home.settings"),
                style: "text",
                action: open(`${site}/settings/calendar`),
              },
            ],
          },
        ],
      },
    ],
  };
}

/** A meeting just made (or the personal room): Join, and the invitation to select and copy. */
export function meetingCard(t: Translate, meeting: AddonMeeting): CardModel {
  return {
    name: "meeting",
    title: escapeText(meeting.title),
    sections: [
      {
        widgets: [
          { kind: "text", text: escapeText(t("meeting.ready")) },
          {
            kind: "buttons",
            buttons: [
              {
                text: t("home.join"),
                style: "filled",
                action: open(meeting.joinUrl),
              },
            ],
          },
          {
            kind: "input",
            name: "invitation",
            label: t("meeting.invitation"),
            hint: t("meeting.invitationHint"),
            value: meeting.invitation,
            multiline: true,
          },
        ],
      },
    ],
  };
}

/**
 * This copy of the add-on isn't the person's own, connected to their FaceOn account:
 * they add theirs in FaceOn's Settings → Calendar, and the card reloads when they're back.
 */
export function notConnectedCard(t: Translate, link: string): CardModel {
  return {
    name: "notConnected",
    title: t("notConnected.title"),
    sections: [
      {
        widgets: [
          { kind: "text", text: escapeText(t("notConnected.body")) },
          {
            kind: "buttons",
            buttons: [
              {
                text: t("notConnected.button"),
                style: "filled",
                action: open(link, true),
              },
            ],
          },
        ],
      },
    ],
  };
}

/** What went wrong, and what to do: add the add-on, read about limits, or try again. */
export function errorCard(t: Translate, error: AddonError): CardModel {
  if (error.code === "NOT_CONNECTED" && error.link) {
    return notConnectedCard(t, error.link);
  }
  if (error.code === "PERMANENT" && error.reason === "dailyLimit") {
    return {
      name: "error",
      title: t("home.open"),
      sections: [
        {
          widgets: [
            { kind: "text", text: escapeText(t("errors.dailyLimit")) },
            ...(error.link
              ? [
                  {
                    kind: "buttons" as const,
                    buttons: [
                      { text: t("errors.limits"), action: open(error.link) },
                    ],
                  },
                ]
              : []),
          ],
        },
      ],
    };
  }
  return {
    name: "error",
    title: t("home.open"),
    sections: [
      {
        widgets: [
          { kind: "text", text: escapeText(t("errors.unreachable")) },
          {
            kind: "buttons",
            buttons: [
              {
                text: t("errors.tryAgain"),
                style: "outlined",
                action: { kind: "run", handler: "onReloadHome" },
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Gmail's compose window: a new meeting (with an optional title) or the personal room. */
export function composeCard(t: Translate): CardModel {
  return {
    name: "compose",
    title: t("compose.title"),
    sections: [
      {
        widgets: [
          {
            kind: "choice",
            name: "which",
            label: t("compose.which"),
            options: [
              { text: t("compose.new"), value: "new", selected: true },
              {
                text: t("compose.personalRoom"),
                value: "personalRoom",
                selected: false,
              },
            ],
          },
          { kind: "input", name: "title", label: t("compose.meetingTitle") },
          {
            kind: "buttons",
            buttons: [
              {
                text: t("compose.insert"),
                style: "filled",
                action: { kind: "run", handler: "onComposeInsert" },
              },
            ],
          },
        ],
      },
    ],
  };
}

/** A meeting ID from what someone typed or pasted: 10 digits, spaces and dashes aside. */
export function meetingIdFrom(typed: string): string | null {
  const digits = typed.replace(/[\s-]/g, "");
  return /^[1-9]\d{9}$/.test(digits) ? digits : null;
}
