import { describe, expect, it } from "vitest";

import {
  addonFiles,
  codeWith,
  conferenceLogo,
  FACEON_CONFERENCE_LOGO_URL,
  fillManifest,
} from "./content";

const template = JSON.stringify({
  urlFetchWhitelist: ["{{FACEON_URL}}/"],
  addOns: {
    common: { name: "{{APP_NAME}}", logoUrl: "{{LOGO_URL}}" },
    calendar: {
      conferenceSolution: [
        {
          name: "{{APP_NAME}} meeting",
          logoUrl: "{{CONFERENCE_LOGO_URL}}",
        },
      ],
    },
  },
});

const copy = {
  url: "https://faceon.test",
  name: "FaceOn",
  logoUrl: "https://faceon.test/icons/icon-192.png",
  conferenceLogoUrl: "https://lh3.googleusercontent.com/logo",
};

describe("fillManifest", () => {
  it("fills in the copy's address, name and logos", () => {
    const manifest = JSON.parse(fillManifest(template, copy)) as {
      urlFetchWhitelist: string[];
      addOns: {
        common: { name: string; logoUrl: string };
        calendar: { conferenceSolution: { name: string; logoUrl: string }[] };
      };
    };
    expect(manifest.urlFetchWhitelist).toEqual(["https://faceon.test/"]);
    expect(manifest.addOns.common).toEqual({
      name: "FaceOn",
      logoUrl: copy.logoUrl,
    });
    expect(manifest.addOns.calendar.conferenceSolution[0]).toEqual({
      name: "FaceOn meeting",
      logoUrl: copy.conferenceLogoUrl,
    });
  });

  it("keeps a name with quotes or dollar signs as it is", () => {
    const odd = { ...copy, name: 'Acme "Meet" $& Co' };
    const manifest = JSON.parse(fillManifest(template, odd)) as {
      addOns: { common: { name: string } };
    };
    expect(manifest.addOns.common.name).toBe('Acme "Meet" $& Co');
  });

  it("fails on a broken template, before Google sees it", () => {
    expect(() => fillManifest('{"name": {{APP_NAME}}}', copy)).toThrow();
  });
});

describe("codeWith and addonFiles", () => {
  const config = {
    url: "https://faceon.test",
    name: "FaceOn",
    version: "a1b2c3",
    connectToken: "tok",
  };

  it("puts the copy's settings ahead of the bundle, where it reads them", () => {
    const code = codeWith(config, "var seen = FACEON_CONFIG;");
    const seen = new Function(`${code}\nreturn seen;`)() as typeof config;
    expect(seen).toEqual(config);
  });

  it("makes the project's two files: the manifest and Code.js", () => {
    const files = addonFiles(
      { version: "a1b2c3", code: "/* bundle */", manifest: template },
      copy,
      config,
    );
    expect(files.map(({ name, type }) => ({ name, type }))).toEqual([
      { name: "appsscript", type: "JSON" },
      { name: "Code", type: "SERVER_JS" },
    ]);
    expect(files[1]?.source).toBe(
      `var FACEON_CONFIG = ${JSON.stringify(config)};\n/* bundle */`,
    );
  });
});

describe("conferenceLogo", () => {
  const icon = "https://faceon.test/icons/icon-192.png";

  it("takes the copy's own, then FaceOn's for FaceOn, then its icon", () => {
    expect(
      conferenceLogo({ name: "Acme", own: "https://lh3.test/a", icon }),
    ).toBe("https://lh3.test/a");
    expect(conferenceLogo({ name: "FaceOn", icon })).toBe(
      FACEON_CONFERENCE_LOGO_URL ?? icon,
    );
    // FaceOn's logo isn't another copy's.
    expect(conferenceLogo({ name: "Acme", icon })).toBe(icon);
  });
});
