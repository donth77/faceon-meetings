import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";

import { routing } from "@/i18n/routing";
import { BRAND_COLORS } from "@/lib/brand";
import { publicEnv } from "@/lib/env";

const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * The page the service worker (public/sw.js) shows when a page can't load for want of a
 * connection. It keeps a copy, so the page has to stand alone: its styles are inline,
 * and its one image (the icon) is kept with it. Try again reloads the address the
 * person opened, fragment and all (a meeting link's passcode lives there).
 */
export async function GET() {
  const saved = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale = hasLocale(routing.locales, saved)
    ? saved
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Pwa.offline" });
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const title = escape(t("title"));
  const { light, dark } = BRAND_COLORS;

  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f5f6f8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e1116" media="(prefers-color-scheme: dark)">
<title>${title} · ${escape(appName)}</title>
<style>
:root { --bg: #f5f6f8; --card: #ffffff; --fg: #12161c; --muted: #4f5966; --border: #e2e5ea; --primary: ${light.brand}; --on-primary: ${light.brandForeground}; --ring: ${light.brand}; color-scheme: light; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #0e1116; --card: #161a21; --fg: #eef1f5; --muted: #a3acb9; --border: #262c36; --primary: ${dark.brand}; --on-primary: ${dark.brandForeground}; --ring: ${dark.brand}; color-scheme: dark; }
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; display: grid; place-items: center; padding: max(24px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { width: 100%; max-width: 420px; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px 24px; border-radius: 20px; background: var(--card); box-shadow: 0 0 0 1px var(--border); text-align: center; }
img { width: 64px; height: 64px; border-radius: 16px; }
h1 { margin: 0; font-size: 24px; line-height: 1.25; text-wrap: balance; }
p { margin: 0; color: var(--muted); }
button { margin-top: 8px; min-height: 48px; padding: 0 24px; border: 0; border-radius: 12px; background: var(--primary); color: var(--on-primary); font: inherit; font-weight: 600; cursor: pointer; }
button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
</style>
</head>
<body>
<main>
<img src="/icons/icon-192.png" alt="">
<h1>${title}</h1>
<p>${escape(t("body", { appName }))}</p>
<button type="button" id="retry">${escape(t("retry"))}</button>
</main>
<script>document.getElementById("retry").addEventListener("click", () => location.reload());</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // The service worker keeps its own copy; the browser's cache shouldn't.
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
