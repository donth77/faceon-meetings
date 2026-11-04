import { StreamError } from "@stream-io/node-sdk";

/** How long to wait before sending a request again after its connection dropped. */
const RETRY_AFTER_MS = 300;

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Whether the connection failed before Stream answered (reset, refused, unreachable):
 * not an answer, which says what went wrong, nor a timeout, after which Stream may still
 * act on the request.
 */
export function droppedBeforeAnswer(error: unknown): boolean {
  return (
    error instanceof StreamError &&
    error.metadata.responseCode === undefined &&
    error.cause instanceof TypeError
  );
}

/**
 * A request that does the same however often it's sent, sent once more if its connection
 * dropped before Stream answered: otherwise one reset connection fails someone's join.
 */
export async function resentIfDropped<T>(
  request: () => Promise<T>,
  wait: (ms: number) => Promise<void> = pause,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!droppedBeforeAnswer(error)) throw error;
    await wait(RETRY_AFTER_MS);
    return request();
  }
}
