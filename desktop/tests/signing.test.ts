import { createRequire } from "node:module";
import type { Configuration } from "electron-builder";
import { describe, expect, it } from "vitest";

import {
  azureSignOptions,
  certificateName,
  publishRefusal,
  SIGNING_SETTINGS,
} from "../scripts/signing.mjs";

const settings = {
  ARTIFACT_SIGNING_ENDPOINT: "https://eus.codesigning.azure.net",
  ARTIFACT_SIGNING_ACCOUNT: "faceon",
  ARTIFACT_SIGNING_PROFILE: "faceonpublic",
};
const none = Object.fromEntries(SIGNING_SETTINGS.map((name) => [name, ""]));

const require = createRequire(import.meta.url);
const CONFIG = "../electron-builder.config.cjs";

/** electron-builder's settings as they load with these in the environment. */
function configWith(env: Record<string, string>): Configuration {
  const before = Object.entries(env).map(
    ([name]) => [name, process.env[name]] as const,
  );
  Object.assign(process.env, env);
  delete require.cache[require.resolve(CONFIG)];
  try {
    return require(CONFIG);
  } finally {
    for (const [name, value] of before) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    delete require.cache[require.resolve(CONFIG)];
  }
}

describe("signing the Windows app", () => {
  it("signs only when the endpoint, account and certificate profile are all set", () => {
    expect(azureSignOptions(settings)).toEqual({
      endpoint: "https://eus.codesigning.azure.net",
      codeSigningAccountName: "faceon",
      certificateProfileName: "faceonpublic",
    });
    for (const name of SIGNING_SETTINGS) {
      expect(azureSignOptions({ ...settings, [name]: "" })).toBeNull();
      expect(azureSignOptions({ ...settings, [name]: " " })).toBeNull();
      expect(azureSignOptions({ ...settings, [name]: undefined })).toBeNull();
    }
    expect(azureSignOptions({})).toBeNull();
  });

  it("names the publisher only when given", () => {
    expect(azureSignOptions(settings)).not.toHaveProperty("publisherName");
    expect(
      azureSignOptions({ ...settings, WINDOWS_PUBLISHER_NAME: "" }),
    ).not.toHaveProperty("publisherName");
    expect(
      azureSignOptions({ ...settings, WINDOWS_PUBLISHER_NAME: " Jane Doe " })
        ?.publisherName,
    ).toBe("Jane Doe");
  });

  it("reaches electron-builder's settings, and only then", () => {
    const signed = configWith({
      ...settings,
      WINDOWS_PUBLISHER_NAME: "Jane Doe",
    });
    expect(signed.win?.azureSignOptions).toEqual({
      endpoint: "https://eus.codesigning.azure.net",
      codeSigningAccountName: "faceon",
      certificateProfileName: "faceonpublic",
      publisherName: "Jane Doe",
    });
    expect(signed.win?.target).toEqual([
      { target: "nsis", arch: ["x64", "arm64"] },
    ]);

    const unsigned = configWith({ ...none, WINDOWS_PUBLISHER_NAME: "" });
    expect(unsigned.win).not.toHaveProperty("azureSignOptions");
    expect(
      configWith({ ...settings, ARTIFACT_SIGNING_PROFILE: "" }).win,
    ).not.toHaveProperty("azureSignOptions");
  });
});

describe("publishing a Windows build", () => {
  it("is refused when it isn't signed, unless --allow-unsigned says so", () => {
    expect(
      publishRefusal({ signed: false, allowUnsigned: false, token: "token" }),
    ).toMatch(/isn't signed/);
    expect(
      publishRefusal({ signed: false, allowUnsigned: true, token: "token" }),
    ).toBeNull();
    expect(
      publishRefusal({ signed: true, allowUnsigned: false, token: "token" }),
    ).toBeNull();
  });

  it("needs a token for the releases repository", () => {
    expect(
      publishRefusal({ signed: true, allowUnsigned: false, token: undefined }),
    ).toMatch(/GH_TOKEN/);
    expect(
      publishRefusal({ signed: true, allowUnsigned: false, token: "" }),
    ).toMatch(/GH_TOKEN/);
  });
});

describe("the name on a certificate", () => {
  it("is its subject's CN", () => {
    expect(
      certificateName(
        "CN=Jane Doe, O=Jane Doe, L=Springfield, S=Illinois, C=US",
      ),
    ).toBe("Jane Doe");
    expect(certificateName("O=Jane Doe, CN=Jane Doe, C=US")).toBe("Jane Doe");
  });

  it("keeps commas and quotes in a quoted name", () => {
    expect(certificateName('CN="Doe, Jane", O="Doe, Jane", C=US')).toBe(
      "Doe, Jane",
    );
    expect(certificateName('CN="Jane ""JD"" Doe", C=US')).toBe('Jane "JD" Doe');
  });

  it("is missing when there's no CN", () => {
    expect(certificateName("O=Jane Doe, C=US")).toBeNull();
    expect(certificateName("CN=, C=US")).toBeNull();
  });
});
