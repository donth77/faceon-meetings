import { describe, expect, it } from "vitest";

import { MEETING_SETTINGS, settingsDrift } from "./call-settings";

/** The call type's settings as Stream returns them: FaceOn's, and others it leaves alone. */
const live = {
  ...MEETING_SETTINGS,
  recording: { mode: "available", quality: "720p" },
  transcription: { mode: "available" },
};

describe("the call type's media settings against FaceOn's setup", () => {
  it("finds nothing when they match, whatever else is set", () => {
    expect(settingsDrift(live)).toEqual([]);
  });

  it("names each setting that differs", () => {
    expect(
      settingsDrift({
        ...live,
        screensharing: {
          ...live.screensharing,
          target_resolution: {
            ...live.screensharing.target_resolution,
            bitrate: 1_500_000,
          },
        },
        audio: { ...live.audio, redundant_coding_enabled: false },
      }),
    ).toEqual([
      "screensharing.target_resolution.bitrate",
      "audio.redundant_coding_enabled",
    ]);
  });

  it("notices a section Stream reset: sent without a setting, it turns it off", () => {
    expect(
      settingsDrift({
        ...live,
        video: { target_resolution: live.video.target_resolution },
      }),
    ).toEqual([
      "video.enabled",
      "video.access_request_enabled",
      "video.camera_default_on",
      "video.camera_facing",
    ]);
  });

  it("names every setting when the call type has none", () => {
    expect(settingsDrift(undefined)).toContain("video.enabled");
    expect(settingsDrift({ ...live, screensharing: null })).toEqual([
      "screensharing.enabled",
      "screensharing.access_request_enabled",
      "screensharing.target_resolution.width",
      "screensharing.target_resolution.height",
      "screensharing.target_resolution.bitrate",
    ]);
  });

  it("leaves the participant limit to each session", () => {
    expect(
      settingsDrift({ ...live, limits: { max_participants: 100 } }),
    ).toEqual([]);
  });
});
