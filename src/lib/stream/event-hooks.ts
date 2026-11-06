/**
 * FaceOn's webhook among Stream's event hooks: the hook `pnpm stream:setup` adds, and
 * what `pnpm stream:check` says about it. Pure, so the setup script can use it.
 */

/** Where FaceOn takes Stream's webhook, on whichever domain the copy runs. */
export const WEBHOOK_PATH = "/api/webhooks/stream";

/** The events FaceOn's webhook needs: who joined and left each call, for attendance. */
export const WEBHOOK_EVENTS = [
  "call.session_participant_joined",
  "call.session_participant_left",
] as const;

/** An event hook as Stream's app settings list it. */
export type EventHook = {
  hook_type?: string;
  enabled?: boolean;
  product?: string;
  webhook_url?: string;
  event_types?: string[];
};

/** Whether a hook's address is FaceOn's webhook, on any domain. */
export function isOurWebhook(url: string | undefined): boolean {
  return !!url && URL.canParse(url) && new URL(url).pathname === WEBHOOK_PATH;
}

/** The hook `pnpm stream:setup` puts in place for `url`. */
export function ourWebhook(url: string): EventHook {
  return {
    hook_type: "webhook",
    enabled: true,
    product: "video",
    webhook_url: url,
    event_types: [...WEBHOOK_EVENTS],
  };
}

/**
 * How FaceOn's webhook stands in Stream: missing, or pointing somewhere (with what's
 * wrong with it, if anything: turned off, not for video, events it doesn't send, or
 * another address than `expected`, where that's given).
 */
export type WebhookCheck =
  | { state: "missing" }
  | { state: "ok" | "drift"; url: string; problems: string[] };

export function checkWebhook(
  hooks: readonly EventHook[] | undefined,
  expected?: string,
): WebhookCheck {
  const ours = (hooks ?? []).filter((hook) => isOurWebhook(hook.webhook_url));
  const hook =
    ours.find((found) => found.webhook_url === expected) ??
    ours.find((found) => found.enabled) ??
    ours[0];
  if (!hook?.webhook_url) return { state: "missing" };
  const events = hook.event_types ?? [];
  const problems = [
    hook.enabled ? "" : "turned off",
    hook.product === "video" ? "" : `product: ${hook.product || "none"}`,
    ...WEBHOOK_EVENTS.filter((event) => !events.includes(event)).map(
      (event) => `not sent: ${event}`,
    ),
    expected && hook.webhook_url !== expected ? `expected ${expected}` : "",
  ].filter(Boolean);
  return {
    state: problems.length === 0 ? "ok" : "drift",
    url: hook.webhook_url,
    problems,
  };
}
