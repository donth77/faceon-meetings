# Releasing the desktop app

For whoever publishes the desktop app: FaceOn's maintainers, or anyone running their own
FaceOn who wants a desktop app named for their copy and opening their site. Running the
app while you work on it is in [DEVELOPING.md](DEVELOPING.md).

## Settings for builds

Builds read `desktop/.env.local` (git-ignored), then the environment. Copy
[`.env.example`](.env.example) there.

| Setting                                                                                | What it's for                                                                                                                                            |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FACEON_APP_URL`                                                                       | The site the app opens. Empty means `https://joinfaceon.app`. A copy of FaceOn sets its own                                                              |
| `NEXT_PUBLIC_APP_NAME`, `DESKTOP_APP_ID`                                               | The app's name and ID. Empty means FaceOn and `app.joinfaceon.desktop`                                                                                   |
| `DESKTOP_RELEASES_REPO`                                                                | `owner/name` of the releases repository (below). Without it the app doesn't look for updates, and nothing can be published                               |
| `GH_TOKEN`                                                                             | Only for publishing: a token that can write that repository's releases                                                                                   |
| `APPLE_KEYCHAIN_PROFILE`, or `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER` | Only for notarizing the Mac app ([Signing on your Mac](#signing-on-your-mac))                                                                            |
| `CSC_LINK`, `CSC_KEY_PASSWORD`                                                         | Only for signing the Mac app with a `.p12` instead of the login keychain, as on GitHub ([Signing the Mac app on GitHub](#signing-the-mac-app-on-github)) |
| `ARTIFACT_SIGNING_ENDPOINT`, `ARTIFACT_SIGNING_ACCOUNT`, `ARTIFACT_SIGNING_PROFILE`    | Only for signing the Windows app ([Signing on Windows](#signing-on-windows))                                                                             |
| `WINDOWS_PUBLISHER_NAME`                                                               | The name on that certificate. Installed apps then accept only updates signed with it                                                                     |

The icons come from the brand: after `pnpm brand`, run `pnpm desktop:icons`.

## Once: where releases live

Downloads and updates come from your repository's **GitHub Releases**, so the repository
must be public: the app's updater and `/download` read its latest release without
signing in. Publish only desktop releases there, since both read whichever is latest.

1. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
   with access to only your repository and **Contents: Read and write**. This is your
   `GH_TOKEN` for publishing.
2. In `desktop/.env.local` on the computers you publish from (your Mac and your Windows
   PC), set `DESKTOP_RELEASES_REPO=<you>/faceon-meetings` and `GH_TOKEN=<the token>`.
3. Optionally, add `DESKTOP_RELEASES_REPO` as a variable in your repository's settings
   (**Settings → Secrets and variables → Actions → Variables**), so CI's test builds look
   for updates too.

Installed apps update from the repository their build named, so changing it later needs
one release published in both places.

## Signing on your Mac

Apple only lets a Mac app open without a warning, and update itself, when it's signed
with a Developer ID and notarized. Here you do that on your own Mac with your own Apple
Developer account; the certificate and passwords stay in your keychain, never in the
repository. Without a Mac, [sign it on GitHub](#signing-the-mac-app-on-github) instead.

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
6. **Build:** `pnpm desktop:mac`. It signs the app and the disk image with your certificate
   (hardened runtime, and the camera and microphone entitlements in
   `build/entitlements.mac.plist`), notarizes and staples both (a few minutes each), and
   checks them, stopping if a check fails. You get `desktop/release/FaceOn.dmg`, plus
   `FaceOn-mac.zip` and `latest-mac.yml` that updates need.
7. **Check it yourself** (the build runs these and shows ✓ or ✗):
   ```bash
   codesign --verify --deep --strict --verbose=2 desktop/release/mac-universal/FaceOn.app
   spctl -a -vvv -t exec desktop/release/mac-universal/FaceOn.app   # "accepted, source=Notarized Developer ID"
   xcrun stapler validate desktop/release/FaceOn.dmg
   spctl -a -vvv -t open --context context:primary-signature desktop/release/FaceOn.dmg
   ```

Without a certificate, `pnpm desktop:mac` still builds, unsigned, and says so. macOS then
blocks it the first time until people choose **System Settings → Privacy & Security →
Open Anyway** (before macOS 15, right-click → **Open** also works), and the app can't
update itself: it says a new version is out and links to the download.

## Signing the Mac app on GitHub

You don't need a Mac for this. GitHub's Mac machines, free for public repositories, sign,
notarize and publish the Mac app with your Apple Developer certificate and key, which stay
in a GitHub environment only `main` can use. You need the Apple Developer Program ($99 a
year), and the Account Holder role to make the certificate.

1. **A certificate request,** made with OpenSSL (Git Bash has it), in a private folder
   outside the repository:
   ```bash
   mkdir -p ~/faceon-apple-signing && cd ~/faceon-apple-signing
   openssl req -new -newkey rsa:2048 -nodes -keyout developer-id.key -out developer-id.csr \
     -subj "/emailAddress=you@example.com/CN=Your Name/C=US"
   ```
   `developer-id.key` is your signing key: keep it in that folder, never in the repository.
2. **A Developer ID Application certificate:** at
   [developer.apple.com → Certificates](https://developer.apple.com/account/resources/certificates/list),
   select **+**, choose **Developer ID Application** with the **G2 Sub-CA** profile, upload
   `developer-id.csr`, and download the certificate (`developerID_application.cer`) into
   the same folder.
3. **A `.p12` with Apple's intermediate certificate,** and a password for it:
   ```bash
   curl -sO https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer
   openssl x509 -inform DER -in developerID_application.cer -out developer-id.pem
   openssl x509 -inform DER -in DeveloperIDG2CA.cer -out developer-id-g2.pem
   openssl rand -base64 24 > p12-password.txt
   openssl pkcs12 -export -legacy -inkey developer-id.key -in developer-id.pem \
     -certfile developer-id-g2.pem -name "Developer ID Application" \
     -passout file:p12-password.txt -out developer-id.p12
   openssl base64 -A -in developer-id.p12 -out developer-id.p12.txt
   ```
   `-legacy` (OpenSSL 3) uses the older encryption that macOS's keychain imports.
4. **An App Store Connect API key,** for notarizing: in
   [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access →
   Integrations → App Store Connect API → Team Keys**, add a key with **Developer** access
   and download its `AuthKey_….p8`, which you can do only once. Note its **Key ID**, and
   the **Issuer ID** above the list.
5. **A `mac-release` environment,** in the repository's **Settings → Environments**, with
   **Deployment branches and tags** set to **Selected branches and tags** → `main`, and
   these secrets:

   | Secret               | Value                                                                     |
   | -------------------- | ------------------------------------------------------------------------- |
   | `MAC_CERTS`          | The contents of `developer-id.p12.txt`                                    |
   | `MAC_CERTS_PASSWORD` | The contents of `p12-password.txt`                                        |
   | `APPLE_API_KEY`      | The contents of the `.p8` file, its `-----BEGIN` and `-----END` lines too |
   | `APPLE_API_KEY_ID`   | The key's Key ID                                                          |
   | `APPLE_API_ISSUER`   | The Issuer ID                                                             |

   Only a run on `main`, started by someone who can write to the repository, can use them;
   pull requests from forks never can. Set the `DESKTOP_RELEASES_REPO` variable (**Settings
   → Secrets and variables → Actions → Variables**) if releases live in another repository.

6. **Run it:** **Actions → Desktop → Run workflow** on `main`, with **Mac release** set to:
   - `draft`, for a new version: it uploads to the version's draft release, making it if
     there's none, and stops if that version is already published.
   - `attach`, to add the Mac app to a version that's already out, such as one published
     for Windows first. It replaces any Mac files that release has.

   The job signs the app and the disk image, notarizes and staples both, and fails unless
   `codesign`, `spctl` (`source=Notarized Developer ID`) and `stapler` all pass. Only then
   does it upload `FaceOn.dmg`, `FaceOn-mac.zip` with its block map, and `latest-mac.yml`.
   Each run also keeps them as an artifact for 14 days.

On a Mac, `pnpm desktop:mac --attach` adds the Mac files to a published release the same
way.

## Signing on Windows

Windows opens an app without a warning only when it's signed, and a PC with Smart App
Control on (as many new Windows 11 PCs are) won't open an unsigned app at all, with no
way past it. You sign on your own Windows PC with
[Azure Artifact Signing](https://learn.microsoft.com/azure/artifact-signing/) (Basic, $9.99
a month), signed in to Azure as yourself; nothing secret goes in the repository or CI.
It's open to organizations, and to individuals in the US and Canada. Windows then shows
your verified name as the publisher.

1. **An Azure subscription**, at [portal.azure.com](https://portal.azure.com). To sign as
   yourself, its billing account must be an Individual one, with your legal name and
   address exactly as on your photo ID (check under **Cost Management + Billing**). The
   city, state and country go on the certificate; the street address doesn't.
2. **Register the service:** **Subscriptions** → your subscription → **Resource
   providers** → **Microsoft.CodeSigning** → **Register**.
3. **An Artifact Signing account:** search the portal for **Artifact Signing Accounts** →
   **Create**, with a new resource group, a name, a region and the **Basic** pricing tier.
   The region sets the endpoint: `https://eus.codesigning.azure.net` for East US, the
   others in [Microsoft's list](https://learn.microsoft.com/azure/artifact-signing/quickstart#azure-regions-that-support-artifact-signing).
4. **Two roles for yourself:** on the account, **Access control (IAM) → Add → Add role
   assignment**, once for **Artifact Signing Identity Verifier** and once for **Artifact
   Signing Certificate Profile Signer**. Being the subscription's owner isn't enough.
5. **Prove who you are:** on the account, **Identity validations** → choose
   **Individual** → **New identity → Public** → your billing account → **Create**. When it
   says **Action Required**, select your name and follow the link: your phone checks your
   photo ID (AU10TIX), then you add the verified ID to Microsoft Authenticator and share
   it. A few minutes later it says **Completed**.
6. **A certificate profile:** **Certificate profiles → Create → Public Trust**, with a name
   and your identity validation. Leave out the street address and postal code.
7. **Set up your PC:** the Azure CLI, to sign in, and the .NET 8 SDK, which the signing
   tools need (they install themselves on the first build):
   ```powershell
   winget install -e --id Microsoft.AzureCLI
   winget install -e --id Microsoft.DotNet.SDK.8
   az login
   ```
   Then clone and install somewhere with a short path, such as `C:\src\faceon-meetings`
   (NSIS, which makes the installer, fails on long ones), and in `desktop/.env.local` set:
   ```bash
   ARTIFACT_SIGNING_ENDPOINT=https://eus.codesigning.azure.net
   ARTIFACT_SIGNING_ACCOUNT=<the account's name>
   ARTIFACT_SIGNING_PROFILE=<the certificate profile's name>
   ```
8. **Build:** `pnpm desktop:win`. You get `desktop/release/FaceOn-Setup.exe`, one per-user
   installer for x64 and Arm64 (about 240 MB). It signs the app and the installer, checks
   each signature (✓ or ✗), and shows the name on the certificate: put that in
   `WINDOWS_PUBLISHER_NAME`, so installed apps accept only updates signed with it.
9. **Check it yourself:** in PowerShell,
   `Get-AuthenticodeSignature desktop\release\FaceOn-Setup.exe` says `Valid`, and the
   installer's **Properties → Digital Signatures → Details** says "This digital signature
   is OK."

Without the settings, `pnpm desktop:win` still builds, unsigned, and says so, and
`--publish` refuses it (`--allow-unsigned` overrides). With them, `pnpm desktop:try` signs
too, so it opens on a PC with Smart App Control on.

CI builds the Windows app for `desktop-v*` tags and **Run workflow**, unsigned, for testing;
signing in CI can be added later. Once the code is public,
[SignPath Foundation](https://signpath.org/) signs open-source releases built by GitHub
Actions for free, as "SignPath Foundation". Since installed apps accept updates only from
`WINDOWS_PUBLISHER_NAME`, a change of signer needs one release that accepts both names
(electron-builder's `publisherName` takes a list).

## Publishing a release

1. Raise `version` in `desktop/package.json` and commit it.
2. On your Windows PC: `pnpm desktop:win --publish`. It signs, checks the signatures and
   uploads the installer to a **draft** release in the releases repository, which it
   makes first, so every file lands in the one draft. It refuses to publish a build that
   isn't signed.
3. The Mac files, to the same draft: on your Mac, `pnpm desktop:mac --publish`, or on
   GitHub, **Actions → Desktop → Run workflow** with **Mac release** set to `draft`. Either
   signs, notarizes and checks the app, and refuses to publish a Mac build that isn't
   signed and notarized.
4. On GitHub, open the releases repository's draft and **Publish release**. Apps then
   update themselves within six hours, or right away from **Check for Updates…**. Mark it
   a pre-release to hold it back from everyone except copies run with
   `FACEON_UPDATE_CHANNEL=beta`. A pre-release isn't offered on `/download` either.

## After the first release

Tell the web app where the releases are: set `DESKTOP_RELEASES_REPO` where FaceOn is
hosted, and `DESKTOP_SIGNED` once builds are signed. `/download` and the **Download for
Windows** and **Download for Mac** buttons then offer it
([DEPLOY.md](../DEPLOY.md#the-desktop-app-optional)).
