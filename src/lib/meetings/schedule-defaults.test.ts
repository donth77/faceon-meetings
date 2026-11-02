import { describe, expect, it } from "vitest";

import {
  nextScheduleDefaults,
  readScheduleDefaults,
  rememberedOptions,
} from "./schedule-defaults";

const used = {
  durationMin: 45,
  passcode: false,
  waitingRoom: false,
  allowGuests: false,
  joinBeforeHost: true,
  muteOnEntry: true,
  autoNotes: true,
  shareNotes: true,
  googleCalendar: false,
};
const everything = { aiNotes: true, calendar: true };

describe("readScheduleDefaults", () => {
  it("keeps what's valid and drops the rest, one option at a time", () => {
    expect(
      readScheduleDefaults({
        durationMin: 3,
        passcode: "yes",
        waitingRoom: false,
        title: "Not remembered",
      }),
    ).toEqual({ waitingRoom: false });
  });

  it("starts from nothing when nothing usable is stored", () => {
    expect(readScheduleDefaults(null)).toEqual({});
    expect(readScheduleDefaults("broken")).toEqual({});
    expect(readScheduleDefaults([1, 2])).toEqual({});
  });
});

describe("nextScheduleDefaults", () => {
  it("remembers the options a meeting was scheduled with, never its details", () => {
    expect(nextScheduleDefaults(null, used, everything)).toEqual(used);
    const withDetails = { ...used, title: "Standup", passcodeText: "K7XQ2M" };
    const kept = nextScheduleDefaults(null, withDetails, everything);
    expect(kept).not.toHaveProperty("title");
    expect(kept).not.toHaveProperty("passcodeText");
  });

  it("keeps the earlier AI notes and Calendar choices where they weren't offered", () => {
    const earlier = {
      autoNotes: true,
      shareNotes: false,
      googleCalendar: true,
    };
    expect(
      nextScheduleDefaults(
        earlier,
        { ...used, autoNotes: false, googleCalendar: false },
        { aiNotes: false, calendar: false },
      ),
    ).toMatchObject(earlier);
  });
});

describe("rememberedOptions", () => {
  const stored = nextScheduleDefaults(null, used, everything);

  it("starts the form from them", () => {
    expect(rememberedOptions(stored, everything)).toEqual(used);
  });

  it("leaves out AI notes where the host's meetings don't offer them, and Calendar where it isn't connected", () => {
    const offered = rememberedOptions(stored, {
      aiNotes: false,
      calendar: false,
    });
    expect(offered).not.toHaveProperty("autoNotes");
    expect(offered).not.toHaveProperty("shareNotes");
    expect(offered).not.toHaveProperty("googleCalendar");
    expect(offered).toMatchObject({ waitingRoom: false, durationMin: 45 });
  });
});
