import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./src/test/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "web",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "scripts/**/*.test.ts",
            "google-addon/src/**/*.test.ts",
          ],
        },
      },
      {
        // The desktop app's shell (desktop/): plain Node, nothing of the web app.
        test: {
          name: "desktop",
          environment: "node",
          include: ["desktop/tests/**/*.test.ts"],
        },
      },
    ],
  },
});
