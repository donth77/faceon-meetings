// The draft release a `--publish` build uploads to. electron-builder makes it on its first
// upload, but it uploads files side by side and each upload can make one, which splits a
// version's files across two drafts. Making the draft before building puts them all in one.

const GITHUB_API = "https://api.github.com";

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
 * Makes the version's draft release in the releases repository, unless it already has a
 * release with that tag.
 * @param {{ repo: string; token: string; version: string; name: string; fetchImpl?: typeof fetch }} options
 * @returns {Promise<"created" | "exists">}
 */
export async function ensureDraftRelease({
  repo,
  token,
  version,
  name,
  fetchImpl = fetch,
}) {
  const tag = releaseTag(version);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const listed = await fetchImpl(
    `${GITHUB_API}/repos/${repo}/releases?per_page=100`,
    { headers },
  );
  if (!listed.ok) {
    throw new Error(
      `GitHub didn't list ${repo}'s releases (HTTP ${listed.status}).`,
    );
  }
  if (releaseForTag(await listed.json(), tag)) return "exists";
  const created = await fetchImpl(`${GITHUB_API}/repos/${repo}/releases`, {
    method: "POST",
    headers,
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
 * Does nothing without a releases repository (DESKTOP_RELEASES_REPO) or a token.
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
  console.log(
    made === "created"
      ? `Made the draft release ${releaseTag(version)} in ${repo}.`
      : `Uploading to ${repo}'s release ${releaseTag(version)}.`,
  );
}
