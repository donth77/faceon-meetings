import type { BrowserContext } from "@playwright/test";

/** Every AI provider's API, as a host's browser calls it, straight from the page. */
const PROVIDER_APIS =
  /^https:\/\/(api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.deepseek\.com|openrouter\.ai)\//;

/** What a provider says about a key it refuses. */
export const REFUSED = "Incorrect API key provided.";

/**
 * Stands in for the AI providers in `context`, so a test never reaches a real one (Settings
 * tests a key as it's entered): a key `accepts` approves gets an answer, enough for that
 * test, and any other is refused as a wrong key is, with the provider's reason.
 */
export async function standInForProviders(
  context: BrowserContext,
  accepts: (key: string) => boolean = () => true,
): Promise<void> {
  await context.route(PROVIDER_APIS, async (route) => {
    const request = route.request();
    const cors = { "access-control-allow-origin": "*" };
    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          ...cors,
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "POST",
        },
      });
      return;
    }
    const headers = request.headers();
    const key =
      headers.authorization?.replace(/^Bearer /, "") ??
      headers["x-api-key"] ??
      headers["x-goog-api-key"] ??
      "";
    await route.fulfill(
      accepts(key)
        ? { status: 200, headers: cors, json: {} }
        : { status: 401, headers: cors, json: { error: { message: REFUSED } } },
    );
  });
}
