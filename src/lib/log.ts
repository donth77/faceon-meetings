/** A failed database query's error as it's safe to keep: the database's own error and code. */
export type QueryFailure = { name: string; message: string; code: unknown };

/**
 * What can be kept of a failed database query's error, or null for any other error. Its
 * message lists the values the query ran with (names, emails), so only the database's own
 * error and code are kept.
 */
export function queryFailure(error: unknown): QueryFailure | null {
  if (!(error instanceof Error) || !error.message.startsWith("Failed query:")) {
    return null;
  }
  const cause: unknown = error.cause;
  return {
    name: error.name,
    message: cause instanceof Error ? cause.message : "Failed query",
    code:
      typeof cause === "object" && cause !== null && "code" in cause
        ? cause.code
        : undefined,
  };
}

/** An error, ready for the server log without personal data (see queryFailure). */
export function loggable(error: unknown): unknown {
  return queryFailure(error) ?? error;
}
