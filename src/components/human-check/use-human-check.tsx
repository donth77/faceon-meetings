"use client";

import { RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import type { HumanCheckAction } from "@/lib/human-check";

/** Turnstile's browser API, as far as FaceOn uses it. */
type Turnstile = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** How long Cloudflare's script may take to load before we offer Try again. */
const LOAD_TIMEOUT_MS = 15_000;
/**
 * How long Join or Send waits for Cloudflare to finish the check before saying it
 * couldn't. Time spent waiting for the person to answer it doesn't count.
 */
const WAIT_MS = 30_000;

let loading: Promise<Turnstile> | null = null;

/** Cloudflare's script, loaded once per page and only where a check is shown. */
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => fail(), LOAD_TIMEOUT_MS);
    function fail() {
      clearTimeout(timer);
      script.remove();
      // The next try starts over.
      loading = null;
      reject(new Error("Turnstile didn't load"));
    }
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      if (window.turnstile) resolve(window.turnstile);
      else fail();
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}

type CheckState = "checking" | "ready" | "interactive" | "failed";

/**
 * Cloudflare Turnstile in managed mode: it decides whether someone needs to do anything,
 * so most people never see it. Where this copy has no site key, or `wanted` is false,
 * there's no check: `view` is empty and `take()` resolves to undefined.
 *
 * `take()` gives the token for one request (waiting for the check if it's still going,
 * and for the person if it's asking them something), or null when the check couldn't
 * finish; tokens work once, so a new check starts behind it. `view` holds Cloudflare's widget (seen only when it asks something) and our own
 * lines: what to do, and Try again when Cloudflare can't load.
 */
export function useHumanCheck(
  action: HumanCheckAction,
  wanted = true,
): {
  enabled: boolean;
  view: ReactNode;
  take: () => Promise<string | null | undefined>;
} {
  const t = useTranslations("HumanCheck");
  const locale = useLocale();
  const siteKey = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const enabled = Boolean(siteKey) && wanted;
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const token = useRef<string | null>(null);
  const waiters = useRef<Array<(token: string | null) => void>>([]);
  const [state, setState] = useState<CheckState>("checking");
  const [waiting, setWaiting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const settle = useEffectEvent((value: string | null) => {
    const pending = waiters.current;
    waiters.current = [];
    if (value !== null && pending.length > 0) token.current = null;
    pending.forEach((resolve, index) => resolve(index === 0 ? value : null));
    setWaiting(false);
  });

  useEffect(() => {
    if (!enabled || !siteKey) return;
    let cancelled = false;
    let id: string | null = null;
    loadTurnstile().then(
      (turnstile) => {
        if (cancelled || !container.current) return;
        id = turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          appearance: "interaction-only",
          size: "flexible",
          theme: "auto",
          language: locale.toLowerCase(),
          "response-field": false,
          "refresh-expired": "auto",
          retry: "never",
          callback: (value: string) => {
            token.current = value;
            setState("ready");
            settle(value);
          },
          "expired-callback": () => {
            token.current = null;
            setState("checking");
          },
          "before-interactive-callback": () => setState("interactive"),
          "after-interactive-callback": () => setState("checking"),
          "timeout-callback": () => {
            token.current = null;
            setState("checking");
            if (id) window.turnstile?.reset(id);
          },
          "error-callback": () => {
            token.current = null;
            setState("failed");
            settle(null);
            return true;
          },
          "unsupported-callback": () => {
            setState("failed");
            settle(null);
          },
        });
        widget.current = id;
      },
      () => {
        if (cancelled) return;
        setState("failed");
        settle(null);
      },
    );
    return () => {
      cancelled = true;
      if (id) window.turnstile?.remove(id);
      widget.current = null;
      token.current = null;
    };
  }, [enabled, siteKey, action, locale, attempt]);

  // Join or Send is waiting: Cloudflare gets WAIT_MS to finish. While it's asking the
  // person something the clock stops, and it starts over once they've answered.
  useEffect(() => {
    if (!waiting || state === "interactive") return;
    const timer = setTimeout(() => {
      setState("failed");
      settle(null);
    }, WAIT_MS);
    return () => clearTimeout(timer);
  }, [waiting, state]);

  function take(): Promise<string | null | undefined> {
    if (!enabled) return Promise.resolve(undefined);
    const ready = token.current;
    if (ready) {
      // One use each: start the next check now, so a retry doesn't wait.
      token.current = null;
      if (widget.current) {
        window.turnstile?.reset(widget.current);
        setState("checking");
      }
      return Promise.resolve(ready);
    }
    if (state === "failed") return Promise.resolve(null);
    setWaiting(true);
    return new Promise((resolve) => {
      waiters.current.push((value) => {
        if (value && widget.current) {
          window.turnstile?.reset(widget.current);
          setState("checking");
        }
        resolve(value);
      });
    });
  }

  const view = enabled ? (
    <div className="flex flex-col gap-2">
      {/* Cloudflare's widget: empty unless the check needs you to do something. */}
      <div ref={container} />
      {state === "interactive" ? (
        <p role="status" className="text-sm leading-normal">
          {t("confirm")}
        </p>
      ) : state === "failed" ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-normal"
        >
          <span>{t("failed")}</span>
          <Button
            variant="outline"
            onPress={() => {
              setState("checking");
              setAttempt((n) => n + 1);
            }}
            className="h-9 rounded-lg px-3 text-sm font-semibold"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("retry")}
          </Button>
        </div>
      ) : waiting ? (
        <p
          role="status"
          className="text-muted-foreground text-sm leading-normal"
        >
          {t("checking")}
        </p>
      ) : null}
    </div>
  ) : null;

  return { enabled, view, take };
}
