import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const config = createRequire(import.meta.url)("../electron-builder.config.cjs");

describe("the app's package", () => {
  it("takes no node_modules, since scripts/build.mjs bundles what it runs", async () => {
    // False tells electron-builder that node_modules are handled elsewhere, so it
    // doesn't pack the workspace root's dependencies into the app.
    expect(await config.beforeBuild()).toBe(false);
  });
});
