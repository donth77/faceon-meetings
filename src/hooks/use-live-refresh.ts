import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** How often a page with a meeting live or due asks again. */
const EVERY_MS = 60_000;
/** Never more often than this, however often the tab is switched back to. */
const MIN_GAP_MS = 15_000;

/**
 * Keeps a page's Live dots current without a reload: the server renders it again
 * (router.refresh) when the tab comes back into view, and every minute while
 * `watching`, that is while one of its meetings is live or due (worthWatching).
 */
export function useLiveRefresh(watching: boolean): void {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    function refresh() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      router.refresh();
    }
    document.addEventListener("visibilitychange", refresh);
    const timer = watching ? window.setInterval(refresh, EVERY_MS) : undefined;
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, [router, watching]);
}
