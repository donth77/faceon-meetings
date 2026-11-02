import "server-only";

import { serverEnv } from "@/lib/server-env";
import { streamProvider } from "@/lib/stream/server";

import type { MediaProvider, MediaProviderId } from "./types";

/** Adapters built into this deployment. LiveKit joins when its adapter exists. */
const ADAPTERS: Partial<Record<MediaProviderId, MediaProvider>> = {
  stream: streamProvider,
};

/** The adapter a session was opened on. Sessions never move between providers. */
export function mediaProvider(id: MediaProviderId): MediaProvider {
  const adapter = ADAPTERS[id];
  if (!adapter) throw new Error(`Media provider "${id}" is not available.`);
  return adapter;
}

/**
 * The provider for a new session: the first one in MEDIA_PROVIDERS that this deployment
 * has. Routing by budget, health and capacity arrives with the second adapter.
 */
export function pickProvider(): MediaProvider {
  for (const id of serverEnv().MEDIA_PROVIDERS) {
    const adapter = ADAPTERS[id];
    if (adapter) return adapter;
  }
  throw new Error("No available media provider is listed in MEDIA_PROVIDERS.");
}

/** Every adapter in this deployment, e.g. to forget a deleted account everywhere. */
export function allProviders(): MediaProvider[] {
  return Object.values(ADAPTERS).filter((adapter) => adapter !== undefined);
}
