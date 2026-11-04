import { describe, expect, it } from "vitest";

import {
  acceptedAsNotarized,
  macReleaseFiles,
  notaryCredentials,
  signingSource,
} from "../scripts/mac-signing.mjs";

describe("signing the Mac app", () => {
  it("signs with a .p12 in CSC_LINK, as on GitHub, where no login keychain has one", () => {
    expect(
      signingSource({ CSC_LINK: "MIIK...", CSC_KEY_PASSWORD: "pw" }, null),
    ).toBe("the Developer ID certificate in CSC_LINK");
  });

  it("needs the .p12's password too", () => {
    expect(signingSource({ CSC_LINK: "MIIK..." }, null)).toBeNull();
  });

  it("otherwise signs with the login keychain's Developer ID, or not at all", () => {
    const identity = "Developer ID Application: Jane Doe (TEAMID1234)";
    expect(signingSource({}, identity)).toBe(identity);
    expect(signingSource({}, null)).toBeNull();
  });
});

describe("notarizing", () => {
  it("prefers a keychain profile", () => {
    expect(
      notaryCredentials({
        APPLE_KEYCHAIN_PROFILE: "faceon-notary",
        APPLE_API_KEY: "/tmp/AuthKey.p8",
        APPLE_API_KEY_ID: "ABC123",
        APPLE_API_ISSUER: "issuer",
      }),
    ).toEqual({
      label: 'keychain profile "faceon-notary"',
      args: ["--keychain-profile", "faceon-notary"],
    });
  });

  it("uses an App Store Connect key, as on GitHub, without showing it", () => {
    const credentials = notaryCredentials({
      APPLE_API_KEY: "/tmp/AuthKey.p8",
      APPLE_API_KEY_ID: "ABC123",
      APPLE_API_ISSUER: "69a6de7e-0000-0000-0000-000000000000",
    });
    expect(credentials?.args).toEqual([
      "--key",
      "/tmp/AuthKey.p8",
      "--key-id",
      "ABC123",
      "--issuer",
      "69a6de7e-0000-0000-0000-000000000000",
    ]);
    expect(credentials?.label).toBe("App Store Connect key ABC123");
  });

  it("uses an Apple ID with an app-specific password, and never puts the password in its label", () => {
    const credentials = notaryCredentials({
      APPLE_ID: "jane@example.com",
      APPLE_APP_SPECIFIC_PASSWORD: "abcd-efgh-ijkl-mnop",
      APPLE_TEAM_ID: "TEAMID1234",
    });
    expect(credentials?.args).toContain("--apple-id");
    expect(credentials?.label).not.toContain("abcd-efgh-ijkl-mnop");
  });

  it("is off without a complete set", () => {
    expect(notaryCredentials({})).toBeNull();
    expect(
      notaryCredentials({
        APPLE_API_KEY: "/tmp/AuthKey.p8",
        APPLE_API_KEY_ID: "ABC",
      }),
    ).toBeNull();
  });
});

describe("what a Mac release carries", () => {
  it("takes the disk image, the update zip with its block map, and latest-mac.yml", () => {
    expect(
      macReleaseFiles([
        "FaceOn.dmg",
        "FaceOn-mac.zip",
        "FaceOn-mac.zip.blockmap",
        "latest-mac.yml",
        "builder-debug.yml",
        "mac-universal",
        "FaceOn-Setup.exe",
        "latest.yml",
      ]),
    ).toEqual([
      "FaceOn-mac.zip",
      "FaceOn-mac.zip.blockmap",
      "FaceOn.dmg",
      "latest-mac.yml",
    ]);
  });
});

describe("Gatekeeper's verdict", () => {
  it("passes only notarized Developer ID software", () => {
    expect(
      acceptedAsNotarized(
        "FaceOn.app: accepted\nsource=Notarized Developer ID\norigin=Developer ID Application: Jane Doe (TEAMID1234)",
      ),
    ).toBe(true);
    expect(
      acceptedAsNotarized(
        "FaceOn.app: rejected\nsource=Unnotarized Developer ID",
      ),
    ).toBe(false);
    expect(
      acceptedAsNotarized("FaceOn.dmg: accepted\nsource=Developer ID"),
    ).toBe(false);
  });
});
