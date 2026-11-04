// The release a `--publish` build uploads to. electron-builder makes it on its first upload,
// but it uploads files side by side and each upload can make one, which splits a version's
// files across two drafts. Making the draft before building puts them all in one. The Mac
// build uploads its own files (scripts/mac.mjs), after notarizing the disk image, and can
// add them to a release that's already out (`--attach`).
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const GITHUB_API = "https://api.github.com";
const GITHUB_UPLOADS = "https://uploads.github.com";

/**
 * The tag electron-builder gives a version's release.
 * @param {string} version
 */
export const releaseTag = (version) => `v${version}`;

/**
 * The release with this tag, draft or published, among a repository's releases.
 * @template {{ tag_name: string }} R
 * @param {R[]} releases
 * @param {string} tag
 * @returns {R | null}
 */
export function releaseForTag(releases, tag) {
  return releases.find((release) => release.tag_name === tag) ?? null;
}

/**
 * What to say when a version's release is already out: electron-builder skips uploading
 * to a published release without a word, so the build would seem to publish and not.
 * @param {string} tag
 * @param {string} repo
 */
export function alreadyPublished(tag, repo) {
  return (
    `${tag} is already published in ${repo}, so there's no draft to upload to.\n` +
    'Raise "version" in desktop/package.json for a new release, or add the Mac build to\n' +
    "this one with `pnpm desktop:mac --attach` (or the Mac release job, set to attach)."
  );
}

/**
 * @typedef {{ id: number; tag_name: string; draft: boolean; assets: { id: number; name: string }[] }} Release
 */

/** @param {string} token */
const apiHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

/**
 * The repository's release with this tag, draft or published; null when it has none.
 * @param {{ repo: string; token: string; tag: string; fetchImpl?: typeof fetch }} options
 * @returns {Promise<Release | null>}
 */
export async function findRelease({ repo, token, tag, fetchImpl = fetch }) {
  const listed = await fetchImpl(
    `${GITHUB_API}/repos/${repo}/releases?per_page=100`,
    { headers: apiHeaders(token) },
  );
  if (!listed.ok) {
    throw new Error(
      `GitHub didn't list ${repo}'s releases (HTTP ${listed.status}).`,
    );
  }
  /** @type {Release[]} */
  const releases = await listed.json();
  return releaseForTag(releases, tag);
}

/**
 * Makes the version's draft release in the releases repository, unless it already has a
 * release with that tag: "exists" for a draft, "published" for one that's out.
 * @param {{ repo: string; token: string; version: string; name: string; fetchImpl?: typeof fetch }} options
 * @returns {Promise<"created" | "exists" | "published">}
 */
export async function ensureDraftRelease({
  repo,
  token,
  version,
  name,
  fetchImpl = fetch,
}) {
  const tag = releaseTag(version);
  const found = await findRelease({ repo, token, tag, fetchImpl });
  if (found) return found.draft ? "exists" : "published";
  const created = await fetchImpl(`${GITHUB_API}/repos/${repo}/releases`, {
    method: "POST",
    headers: apiHeaders(token),
    body: JSON.stringify({ tag_name: tag, name, draft: true }),
  });
  if (!created.ok) {
    throw new Error(
      `GitHub didn't make the draft release ${tag} (HTTP ${created.status}).`,
    );
  }
  return "created";
}

/**
 * Before a `--publish` build: makes sure the version's draft release exists, and says so.
 * Stops when that version is already published. Does nothing without a releases
 * repository (DESKTOP_RELEASES_REPO) or a token.
 * @param {{ productName: string; version: string }} app
 */
export async function prepareRelease({ productName, version }) {
  const repo = process.env.DESKTOP_RELEASES_REPO?.trim();
  const token = process.env.GH_TOKEN?.trim();
  if (!repo || !token) return;
  const made = await ensureDraftRelease({
    repo,
    token,
    version,
    name: `${productName} ${version}`,
  });
  if (made === "published") {
    throw new Error(alreadyPublished(releaseTag(version), repo));
  }
  console.log(
    made === "created"
      ? `Made the draft release ${releaseTag(version)} in ${repo}.`
      : `Uploading to ${repo}'s draft release ${releaseTag(version)}.`,
  );
}

/**
 * Uploads files to the version's release, replacing any file of the same name there. A
 * published release takes them only when `allowPublished` says so (`--attach`).
 * @param {{ repo: string; token: string; version: string; files: string[]; allowPublished: boolean; fetchImpl?: typeof fetch; read?: (path: string) => Promise<Uint8Array> }} options
 * @returns {Promise<string[]>} The names uploaded.
 */
export async function uploadReleaseFiles({
  repo,
  token,
  version,
  files,
  allowPublished,
  fetchImpl = fetch,
  read = readFile,
}) {
  const tag = releaseTag(version);
  const release = await findRelease({ repo, token, tag, fetchImpl });
  if (!release) {
    throw new Error(
      `${repo} has no release ${tag} yet: publish one first (\`--publish\` makes the draft).`,
    );
  }
  if (!release.draft && !allowPublished) {
    throw new Error(alreadyPublished(tag, repo));
  }
  const uploaded = [];
  for (const file of files) {
    const name = basename(file);
    const old = release.assets.find((asset) => asset.name === name);
    if (old) {
      const removed = await fetchImpl(
        `${GITHUB_API}/repos/${repo}/releases/assets/${old.id}`,
        { method: "DELETE", headers: apiHeaders(token) },
      );
      if (!removed.ok && removed.status !== 404) {
        throw new Error(
          `GitHub didn't remove the old ${name} from ${tag} (HTTP ${removed.status}).`,
        );
      }
    }
    const added = await fetchImpl(
      `${GITHUB_UPLOADS}/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: {
          ...apiHeaders(token),
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(await read(file)),
      },
    );
    if (!added.ok) {
      throw new Error(
        `GitHub didn't take ${name} for ${tag} (HTTP ${added.status}).`,
      );
    }
    uploaded.push(name);
  }
  return uploaded;
}
