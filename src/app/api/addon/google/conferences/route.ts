import { ConferenceCreate } from "@/lib/addon/google/api";
import { handleAddonRequest, readAddonJson } from "@/lib/addon/google/http";
import { createConference } from "@/lib/addon/google/service";

/** POST /api/addon/google/conferences: "FaceOn meeting" chosen for a Calendar event. */
export async function POST(request: Request) {
  return handleAddonRequest(request, async (host) =>
    Response.json(
      await createConference(
        host,
        await readAddonJson(request, ConferenceCreate),
      ),
    ),
  );
}
