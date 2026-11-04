/**
 * The repository's home page, opened at its README's title. GitHub gives each README
 * heading an anchor from its text, and the README is titled after the repository
 * ("FaceOn Meetings" → #faceon-meetings), so a fork titled after its own name lands there
 * too. An address that already has an anchor is left as it is.
 */
export function repoHomeUrl(repoUrl: string): string {
  const repo = repoUrl.trim().replace(/\/+$/, "");
  if (repo.includes("#")) return repo;
  const name = repo.split("/").pop()?.toLowerCase() ?? "";
  return /^[a-z0-9_-]+$/.test(name) ? `${repo}#${name}` : repo;
}
