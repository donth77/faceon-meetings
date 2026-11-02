import { NextResponse } from "next/server";

import { latestDesktopRelease } from "@/lib/desktop/releases";

/** The desktop app's latest release, for "Get the desktop app" (lib/desktop/releases.ts). */
export async function GET() {
  const release = await latestDesktopRelease();
  return NextResponse.json(
    release ? { available: true, ...release } : { available: false },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
