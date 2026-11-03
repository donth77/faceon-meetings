import type { BrowserContext, Page } from "@playwright/test";

/** What a check does in the stand-in: pass by itself, ask the person, or fail. */
export type CheckOutcome = "pass" | "ask" | "fail";

/** Cloudflare's Turnstile script, as the app loads it. */
const TURNSTILE_SCRIPT =
  /^https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/;

/**
 * Serves a stand-in for Cloudflare's Turnstile script, so the tests never reach
 * Cloudflare. Each check (the first, and each one after a reset) takes the next of
 * `outcomes`, and the last one repeats. The fixtures give every browser a stand-in that
 * passes; a test that wants another sets one on its page before going anywhere (a page's
 * route wins over its browser's).
 */
export async function fakeHumanCheck(
  target: Page | BrowserContext,
  outcomes: CheckOutcome[] = ["pass"],
): Promise<void> {
  const body = `(${turnstile.toString()})(${JSON.stringify(outcomes)});`;
  await target.route(TURNSTILE_SCRIPT, (route) =>
    route.fulfill({ contentType: "text/javascript", body }),
  );
}

/**
 * window.turnstile, as far as the app uses it, set up in the page. "ask" shows a "Verify
 * you are human" checkbox, as Cloudflare's widget does when it isn't sure, and passes once
 * it's ticked; "fail" reports an error, as a check Cloudflare turns down does.
 */
function turnstile(outcomes: CheckOutcome[]) {
  type Widget = {
    container: HTMLElement;
    options: Record<string, unknown>;
    run: number;
  };
  const widgets = new Map<string, Widget>();
  let ids = 0;
  let runs = 0;
  let tokens = 0;

  const call = (widget: Widget, name: string, value?: string) =>
    (widget.options[name] as ((value?: string) => unknown) | undefined)?.(
      value,
    );

  function check(id: string) {
    const widget = widgets.get(id);
    if (!widget) return;
    const run = ++runs;
    widget.run = run;
    widget.container.replaceChildren();
    const outcome = outcomes[Math.min(run, outcomes.length) - 1];
    // Cloudflare answers later, never during render() or reset(), and a reset or
    // remove cancels a check that hasn't finished.
    const current = () => widgets.get(id) === widget && widget.run === run;
    const pass = () => call(widget, "callback", `fake-token-${++tokens}`);
    const ask = () => {
      call(widget, "before-interactive-callback");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.addEventListener("change", () => {
        if (!current()) return;
        widget.container.replaceChildren();
        call(widget, "after-interactive-callback");
        setTimeout(() => {
          if (current()) pass();
        });
      });
      const label = document.createElement("label");
      label.append(box, "Verify you are human");
      widget.container.append(label);
    };
    setTimeout(() => {
      if (!current()) return;
      if (outcome === "pass") pass();
      else if (outcome === "fail") call(widget, "error-callback", "600010");
      else ask();
    });
  }

  Object.assign(window, {
    turnstile: {
      render(container: HTMLElement, options: Record<string, unknown>) {
        const id = `fake-${++ids}`;
        widgets.set(id, { container, options, run: 0 });
        check(id);
        return id;
      },
      reset: check,
      remove(id: string) {
        widgets.get(id)?.container.replaceChildren();
        widgets.delete(id);
      },
    },
  });
}
