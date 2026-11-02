# FaceOn for macOS and Windows

The desktop app is a thin shell around the hosted web app: one window that loads it, plus
what a browser tab can't do. That means opening `faceon://` meeting links, living in the
tray or menu bar, a mute shortcut that works from any app, a native screen-share picker,
meeting reminders and an unread badge while no browser is open, and updates. Everything
inside the window is the web app itself, so the app never falls behind it. Linux comes
after 1.0; the code stays portable for it.

It's [Electron](https://www.electronjs.org/) in this folder, a pnpm workspace package
(`@faceon/desktop`).

## Run it while you work

```bash
pnpm dev            # the web app, in one terminal
pnpm desktop:dev    # the app, opening http://localhost:3000
```

The first run downloads Electron for your computer (web installs and Vercel never do).
`FACEON_APP_URL=https://… pnpm desktop:dev` points it at another copy of the site.

## Settings for builds

Builds read `desktop/.env.local` (git-ignored), then the environment. Copy
[`.env.example`](.env.example) there.

| Setting                                                                                | What it's for                                                                                                              |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `FACEON_APP_URL`                                                                       | The site the app opens. Empty means `https://joinfaceon.app`. A copy of FaceOn sets its own                                |
| `NEXT_PUBLIC_APP_NAME`, `DESKTOP_APP_ID`                                               | The app's name and ID. Empty means FaceOn and `app.joinfaceon.desktop`                                                     |
| `DESKTOP_RELEASES_REPO`                                                                | `owner/name` of the releases repository (below). Without it the app doesn't look for updates, and nothing can be published |
| `GH_TOKEN`                                                                             | Only for publishing: a token that can write that repository's releases                                                     |
| `APPLE_KEYCHAIN_PROFILE`, or `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER` | Only for notarizing the Mac app (step 4 below)                                                                             |

The icons come from the brand: after `pnpm brand`, run `pnpm desktop:icons`.

## Once: the releases repository

While the code is private, downloads and updates live in a small **public**
repository that holds only releases. The app's updater reads it, and it's free.

1. On GitHub, create a public repository named, for example, `faceon-desktop-releases`.
   Leave it empty.
2. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
   with access to only that repository and **Contents: Read and write**. This is your
   `GH_TOKEN` for publishing.
3. In `desktop/.env.local` on your Mac, set `DESKTOP_RELEASES_REPO=<you>/faceon-desktop-releases`
   and `GH_TOKEN=<the token>`.
4. For the Windows builds in CI, add the same two in this repository's settings
   (**Settings → Secrets and variables → Actions**): a variable `DESKTOP_RELEASES_REPO`
   and a secret `DESKTOP_RELEASES_TOKEN`.

Once the code is public, releases can move to its own repository instead.

## Signing on your Mac

Apple only lets a Mac app open without a warning, and update itself, when it's signed
with a Developer ID and notarized. You do that on your own Mac with your own Apple
Developer account; the certificate and passwords stay in your keychain, never in the
repository or CI.

1. **Xcode's command line tools:** `xcode-select --install`.
2. **The Apple Developer Program** ($99 a year), at [developer.apple.com](https://developer.apple.com/programs/).
3. **A Developer ID Application certificate:**
   1. Open **Keychain Access → Certificate Assistant → Request a Certificate From a
      Certificate Authority…**. Enter your email, choose **Saved to disk**, and save the
      `.certSigningRequest` file.
   2. At [developer.apple.com → Certificates](https://developer.apple.com/account/resources/certificates/list),
      select **+**, choose **Developer ID Application**, upload that file, and download
      the certificate.
   3. Double-click the downloaded `.cer` to add it to your login keychain.
   4. Check: `security find-identity -v -p codesigning` lists
      `Developer ID Application: Your Name (TEAMID)`.
4. **A notary profile**, so notarization never asks for a password:
   1. At [account.apple.com](https://account.apple.com) → **Sign-In and Security →
      App-Specific Passwords**, make one for "FaceOn notarization".
   2. Run:
      ```bash
      xcrun notarytool store-credentials faceon-notary \
        --apple-id you@example.com --team-id TEAMID --password <the app-specific password>
      ```
   3. Put `APPLE_KEYCHAIN_PROFILE=faceon-notary` in `desktop/.env.local`.

   An App Store Connect API key works instead: set `APPLE_API_KEY` (the `.p8` file's
   path), `APPLE_API_KEY_ID` and `APPLE_API_ISSUER`.

5. **Clone and install:**
   ```bash
   git clone https://github.com/<you>/faceon-meetings.git
   cd faceon-meetings
   pnpm install
   ```
6. **Build:** `pnpm desktop:mac`. It signs with your certificate (hardened runtime, and the
   camera and microphone entitlements in `build/entitlements.mac.plist`), notarizes
   (a few minutes), staples the ticket, and checks the result. You get
   `desktop/release/FaceOn-<version>-universal.dmg`, plus the `.zip` and `latest-mac.yml`
   that updates need.
7. **Check it yourself** (the build runs these and shows ✓ or ✗):
   ```bash
   codesign --verify --deep --strict --verbose=2 desktop/release/mac-universal/FaceOn.app
   spctl -a -vvv -t exec desktop/release/mac-universal/FaceOn.app   # "accepted, source=Notarized Developer ID"
   xcrun stapler validate desktop/release/FaceOn-*.dmg
   ```

Without a certificate, `pnpm desktop:mac` still builds, unsigned, and says so. macOS then
asks people to right-click → **Open** the first time (or **System Settings → Privacy &
Security → Open Anyway**), and the app can't update itself: it says a new version is out
and links to the download.

## Publishing a release

1. Raise `version` in `desktop/package.json` and commit it.
2. Tag it: `git tag desktop-v1.0.0 && git push origin desktop-v1.0.0`. CI builds the
   Windows installers and uploads them to a **draft** release in the releases
   repository.
3. On your Mac: `pnpm desktop:mac --publish`. It signs, notarizes and uploads the Mac
   files to the same draft. It refuses to publish a Mac build that isn't signed and
   notarized.
4. On GitHub, open the releases repository's draft and **Publish release**. Apps then
   update themselves within six hours, or right away from **Check for Updates…**. Mark
   it a pre-release to send it only to people on Test builds.

## Windows

`pnpm desktop:win` builds the per-user installer (x64 and Arm64) on a Windows computer,
and CI does the same for tags. It's unsigned for now, so Windows SmartScreen shows "Windows
protected your PC" (More info → Run anyway) until it's signed. Once the code is public,
SignPath gives open-source projects free code signing; until then, Azure Trusted Signing
(about $10 a month) is the paid route. Either goes into the `desktop-v*` workflow.

## Tests

- `pnpm test` runs the shell's unit tests with the rest (`tests/*.test.ts`): links, the
  origin and permission rules, settings checks, sign-in's state and verifier, and
  reminders.
- `pnpm --filter @faceon/desktop test:e2e` runs Electron with its windows hidden against
  a stand-in site, and checks the window, the bridge, links, navigation, permissions and
  the mute shortcut.
- [QA.md](QA.md) is the checklist for each release, by hand on a Mac and a Windows PC.

## How it's built

- `src/main/`: the main process. `window.ts` (the one window, its size and place kept),
  `security.ts` and `policy.ts` (only the app's origin in the window; other sites open in
  the browser; a meeting's permissions only), `links.ts` (`faceon://`), `ipc.ts` and
  `schemas.ts` (the bridge, every call checked with Zod), `sign-in.ts` (Google and
  GitHub through the system browser), `tray.ts`, `shortcut.ts`, `share-picker.ts`,
  `reminders.ts`, `badge.ts`, `updates.ts` and `store.ts` (Settings → Desktop app, in
  `userData/state.json`).
- `src/preload/`: `window.faceonDesktop`, only on the app's origin, and the share
  picker's own small bridge. Windows are sandboxed, with context isolation and no Node.
- The bridge's contract is the web app's `src/lib/desktop/bridge.ts`, imported for types
  only, so the two can't drift.
- Electron's fuses turn off running as Node and Node options, and load the app only from
  its checked archive.
