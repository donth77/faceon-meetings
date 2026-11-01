import { renderAvatarSvg } from "@/lib/avatars/render";
import { parseAvatarSeed } from "@/lib/avatars/seed";

/**
 * GET /avatar/{seed}.svg: the default Dylan avatar for a seed. The seed is random and
 * reveals nothing about the person; responses never change, so the CDN caches them for good.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/avatar/[seed]">,
) {
  const { seed: raw } = await params;
  const parsed = parseAvatarSeed(raw.replace(/\.svg$/, ""));
  if (!parsed) return new Response("Not found", { status: 404 });

  return new Response(renderAvatarSvg(parsed.seed, parsed.look), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
