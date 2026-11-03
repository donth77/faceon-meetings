# Releasing the desktop app

For whoever publishes the desktop app: FaceOn's maintainers, or anyone running their own
FaceOn who wants a desktop app named for their copy and opening their site. Running the
app while you work on it is in [DEVELOPING.md](DEVELOPING.md).

## Settings for builds

Builds read `desktop/.env.local` (git-ignored), then the environment. Copy
[`.env.example`](.env.example) there.

| Setting                                                                                | What it's for                                                                                                              |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `FACEON_APP_URL`                                                                       | The site the app opens. Empty means `https://joinfaceon.app`. A copy of FaceOn sets its own                                |
| `NEXT_PUBLIC_APP_NAME`, `DESKTOP_APP_ID`                                               | The app's name and ID. Empty means FaceOn and `app.joinfaceon.desktop`                                                     |
| `DESKTOP_RELEASES_REPO`                                                                | `owner/name` of the releases repository (below). Without it the app doesn't look for updates, and nothing can be published |
| `GH_TOKEN`                                                                             | Only for publishing: a token that can write that repository's releases                                                     |
| `APPLE_KEYCHAIN_PROFILE`, or `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER` | Only for notarizing the Mac app ([Signing on your Mac](#signing-on-your-mac))                                              |

The icons come from the brand: after `pnpm brand`, run `pnpm desktop:icons`.

## Once: the releases repository

While the code is private, downloads and updates live in a small **public** repository
that holds only releases. The app's updater reads it, and it's free.

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
   `desktop/release/FaceOn.dmg`, plus `FaceOn-mac.zip` and `latest-mac.yml`
   that updates need.
7. **Check it yourself** (the build runs these and shows ✓ or ✗):
   ```bash
   codesign --verify --deep --strict --verbose=2 desktop/release/mac-universal/FaceOn.app
   spctl -a -vvv -t exec desktop/release/mac-universal/FaceOn.app   # "accepted, source=Notarized Developer ID"
   xcrun stapler validate desktop/release/FaceOn.dmg
   ```

Without a certificate, `pnpm desktop:mac` still builds, unsigned, and says so. macOS then
asks people to right-click → **Open** the first time (or **System Settings → Privacy &
Security → Open Anyway**), and the app can't update itself: it says a new version is out
and links to the download.

## Windows

`pnpm desktop:win` builds the per-user installer on a Windows computer, and CI does the
same for tags: `desktop/release/FaceOn-Setup.exe`, one installer for x64 and Arm64 (about
240 MB).

If it stops with NSIS saying it "could not find" an include, the folder path is too long
for NSIS (Windows' 260-character limit). Clone somewhere shorter, such as
`C:\src\faceon-meetings`.

It's unsigned for now, so Windows SmartScreen shows "Windows protected your PC" (**More
info → Run anyway**) until it's signed. Two ways to sign it, either going into the
`desktop-v*` workflow:

- **[SignPath Foundation](https://signpath.org/)**, free for open-source projects once
  the code is public and releases are built by GitHub Actions from it. Windows shows
  "SignPath Foundation" as the publisher.
- **[Azure Artifact Signing](https://azure.microsoft.com/pricing/details/trusted-signing/)**,
  about $10 a month, open to individuals in the US and Canada. Windows shows your
  verified name. electron-builder supports it directly.

## Publishing a release

1. Raise `version` in `desktop/package.json` and commit it.
2. Tag it: `git tag desktop-v1.0.0 && git push origin desktop-v1.0.0`. CI builds the
   Windows installer and uploads it to a **draft** release in the releases repository.
3. On your Mac: `pnpm desktop:mac --publish`. It signs, notarizes and uploads the Mac
   files to the same draft. It refuses to publish a Mac build that isn't signed and
   notarized.
4. On GitHub, open the releases repository's draft and **Publish release**. Apps then
   update themselves within six hours, or right away from **Check for Updates…**. Mark it
   a pre-release to hold it back from everyone except copies run with
   `FACEON_UPDATE_CHANNEL=beta`. A pre-release isn't offered on `/download` either.

## After the first release

Tell the web app where the releases are: set `DESKTOP_RELEASES_REPO` where FaceOn is
hosted, and `DESKTOP_SIGNED` once builds are signed. `/download` and the **Download for
Windows** and **Download for Mac** buttons then offer it
([DEPLOY.md](../DEPLOY.md#the-desktop-app-optional)).
