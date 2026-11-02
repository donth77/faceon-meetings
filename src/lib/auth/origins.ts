/**
 * The origins allowed to use sign-in, and to be sent back to after it or after a
 * password reset: the production site, this deployment's own addresses on Vercel (a
 * preview), and localhost in development. Never a wildcard: a reset link carries a
 * token, so it must only ever lead back to this copy of FaceOn. Operators can add exact
 * origins with BETTER_AUTH_TRUSTED_ORIGINS, which Better Auth reads itself.
 */
export function authOrigins(env: {
  productionUrl: string;
  /** Vercel's VERCEL_URL: this deployment's own address, without a scheme. */
  vercelUrl?: string;
  /** Vercel's VERCEL_BRANCH_URL: a preview's address for its branch. */
  vercelBranchUrl?: string;
  development: boolean;
}): string[] {
  const origins = new Set([new URL(env.productionUrl).origin]);
  for (const host of [env.vercelUrl, env.vercelBranchUrl]) {
    if (host) origins.add(`https://${host}`);
  }
  if (env.development) origins.add("http://localhost:3000");
  return [...origins];
}
