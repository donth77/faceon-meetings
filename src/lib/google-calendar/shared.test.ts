import { describe, expect, it } from "vitest";

import {
  connectProblem,
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_SCRIPT_SCOPE,
  hasCalendarScope,
  hasScope,
  withoutCalendarScope,
  withoutScope,
} from "./shared";

describe("calendar scope", () => {
  const granted = `email,profile,openid,${GOOGLE_CALENDAR_SCOPE}`;

  it("finds calendar access among an account's scopes", () => {
    expect(hasCalendarScope(granted)).toBe(true);
    expect(hasCalendarScope(`openid ${GOOGLE_CALENDAR_SCOPE}`)).toBe(true);
    expect(hasCalendarScope("email,profile,openid")).toBe(false);
    // A broader-sounding scope isn't the one FaceOn asked for.
    expect(
      hasCalendarScope("https://www.googleapis.com/auth/calendar.events"),
    ).toBe(false);
    expect(hasCalendarScope(null)).toBe(false);
  });

  it("forgets only calendar access", () => {
    expect(withoutCalendarScope(granted)).toBe("email,profile,openid");
  });

  it("tells the add-on's scope apart from calendar access", () => {
    const both = `${granted},${GOOGLE_SCRIPT_SCOPE}`;
    expect(hasScope(both, GOOGLE_SCRIPT_SCOPE)).toBe(true);
    expect(hasScope(granted, GOOGLE_SCRIPT_SCOPE)).toBe(false);
    expect(withoutScope(both, GOOGLE_SCRIPT_SCOPE)).toBe(granted);
    expect(withoutCalendarScope(both)).toBe(
      `email,profile,openid,${GOOGLE_SCRIPT_SCOPE}`,
    );
  });
});

describe("connectProblem", () => {
  it("explains why connecting didn't work", () => {
    expect(connectProblem(null)).toBe("scope");
    expect(connectProblem("access_denied")).toBe("denied");
    expect(connectProblem("email_does_not_match")).toBe("emailMismatch");
    expect(connectProblem("account_already_linked_to_different_user")).toBe(
      "alreadyLinked",
    );
    expect(connectProblem("state_not_found")).toBe("generic");
  });
});
