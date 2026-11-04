"use client";

import { useEffect, useSyncExternalStore } from "react";

import { testKey } from "./engines";
import {
  ProviderError,
  type ProviderFailure,
  type ProviderId,
} from "./providers";

/** Whether an AI key works with its provider and model, as the provider answered. */
export type KeyCheck =
  | { state: "testing" | "works" }
  | { state: "failed"; failure: ProviderFailure; detail: string };

type Choice = { provider: ProviderId; model: string; key: string };

/** How long after a key stops changing it's tested, so typing one tests it once. */
export const TEST_AFTER_MS = 800;

/**
 * Each key's answer, asked once per provider, model and key while this tab is open, so
 * Settings (as the key is entered) and the meeting (as AI notes start) share one request.
 * Kept in memory only, like the key's own copy in this tab.
 */
const checks = new Map<string, KeyCheck>();
const listeners = new Set<() => void>();

const idOf = ({ provider, model, key }: Choice) =>
  `${provider}\n${model}\n${key}`;

function settle(id: string, check: KeyCheck) {
  checks.set(id, check);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** What the provider said about the key, if it's been asked. */
export function keyCheckOf(choice: Choice): KeyCheck | null {
  return checks.get(idOf(choice)) ?? null;
}

/** What a test that failed says: the provider's reason, where it gave one. */
export function failedCheck(error: unknown): KeyCheck {
  return error instanceof ProviderError
    ? { state: "failed", failure: error.failure, detail: error.detail }
    : { state: "failed", failure: "other", detail: "" };
}

/** Asks the provider whether the key works, unless it's been asked already. */
export function checkKey(choice: Choice): void {
  const id = idOf(choice);
  if (checks.has(id)) return;
  settle(id, { state: "testing" });
  testKey(choice).then(
    () => settle(id, { state: "works" }),
    (error: unknown) => settle(id, failedCheck(error)),
  );
}

/** Asks again, whatever it said before (Test key). */
export function recheckKey(choice: Choice): void {
  if (checks.get(idOf(choice))?.state === "testing") return;
  checks.delete(idOf(choice));
  checkKey(choice);
}

/**
 * The answer about this key, asking for it `delayMs` after the key stops changing (so
 * typing one asks once). Null with no key, or before it's asked.
 */
export function useKeyCheck(
  choice: Choice | null,
  delayMs: number,
): KeyCheck | null {
  const provider = choice?.provider;
  const model = choice?.model;
  const key = choice?.key;
  const check = useSyncExternalStore(
    subscribe,
    () =>
      provider && model !== undefined && key
        ? keyCheckOf({ provider, model, key })
        : null,
    () => null,
  );
  useEffect(() => {
    if (!provider || model === undefined || !key) return;
    const timer = window.setTimeout(
      () => checkKey({ provider, model, key }),
      delayMs,
    );
    return () => window.clearTimeout(timer);
  }, [provider, model, key, delayMs]);
  return check;
}

/** Failures that are about the key, its model or its account, not the connection. */
export const keyProblem = (check: KeyCheck | null) =>
  check?.state === "failed" &&
  (check.failure === "key" ||
    check.failure === "model" ||
    check.failure === "limit")
    ? check
    : null;
