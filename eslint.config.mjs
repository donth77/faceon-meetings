import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Media SDKs stay inside the provider adapters; everything else uses src/lib/media.
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/stream/**",
      "src/lib/livekit/**",
      "src/components/meeting/providers/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@stream-io/*"],
              message:
                "Use the media-provider interface (src/lib/media); Stream SDKs belong in src/lib/stream.",
            },
            {
              group: ["livekit-*", "@livekit/*"],
              message:
                "Use the media-provider interface (src/lib/media); LiveKit SDKs belong in src/lib/livekit.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
