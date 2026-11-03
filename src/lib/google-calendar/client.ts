import "server-only";

/** Whether this copy has a Google OAuth client, which everything with Google needs. */
export function googleClientConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}
