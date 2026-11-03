import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { desktopAssetNames } from "../../src/lib/desktop/downloads";

const config = createRequire(import.meta.url)("../electron-builder.config.cjs");

describe("the installers' names", () => {
  it("are the ones the website links to (releases/latest/download/<name>)", () => {
    const names = desktopAssetNames(config.productName);
    expect(config.nsis.artifactName.replace("${ext}", "exe")).toBe(
      names.windows,
    );
    expect(config.dmg.artifactName.replace("${ext}", "dmg")).toBe(names.mac);
  });
});
