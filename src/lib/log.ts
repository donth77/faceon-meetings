/**
 * An error, ready for the server log without personal data. A failed database query's
 * message lists the values it ran with (names, emails), so for those only the
 * database's own error and code are kept.
 */
export function loggable(error: unknown): unknown {
  if (!(error instanceof Error) || !error.message.startsWith("Failed query:")) {
    return error;
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
