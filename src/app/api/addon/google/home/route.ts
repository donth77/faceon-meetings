import { HomeQuery } from "@/lib/addon/google/api";
import { AddonFailure, handleAddonRequest } from "@/lib/addon/google/http";
import { addonHome } from "@/lib/addon/google/service";

/** GET /api/addon/google/home: the sidebar's personal room and next meetings. */
export async function GET(request: Request) {
  return handleAddonRequest(request, async (host) => {
    const query = HomeQuery.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) throw new AddonFailure("BAD_REQUEST");
    return Response.json(await addonHome(host, query.data));
  });
}
