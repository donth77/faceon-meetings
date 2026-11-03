import { getTranslations } from "next-intl/server";

import { getSession } from "@/lib/auth/session";
import { emailLocale } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { attachment, fileName, spreadsheetDay } from "@/lib/exports/format";
import { yourDataLabels } from "@/lib/exports/labels";
import { exportLimits } from "@/lib/exports/limits";
import { yourData } from "@/lib/exports/your-data";
import { yourDataFiles } from "@/lib/exports/your-data-files";
import { zipStream } from "@/lib/exports/zip";
import { loggable } from "@/lib/log";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/same-origin";
import { isTimeZone } from "@/lib/time";

/**
 * GET /api/account/export?tz=…: Settings → Account's "Download your data". A zip of
 * everything kept about the signed-in person that they may see, made on request and
 * streamed, with nothing stored and no one else involved. It shares Download history's
 * budget per account.
 */
export async function GET(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const limits = exportLimits(session.user.id);
  try {
    if (await isLimited(limits)) {
      return Response.json({ error: "tooMany" }, { status: 429 });
    }
    await recordAttempt(limits);

    const zone = new URL(request.url).searchParams.get("tz");
    const timeZone = isTimeZone(zone) ? zone : "UTC";
    const locale = emailLocale(session.user);
    const now = new Date();
    const [data, labels, t] = await Promise.all([
      yourData(session.user),
      yourDataLabels({ locale, timeZone, reader: session.user, now }),
      getTranslations({ locale, namespace: "Exports" }),
    ]);
    const name = fileName(
      t("dataFile", {
        appName: publicEnv.NEXT_PUBLIC_APP_NAME,
        date: spreadsheetDay(now, timeZone),
      }),
    );
    return new Response(zipStream(yourDataFiles(data, { labels, timeZone })), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": attachment(`${name}.zip`),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Data download failed", loggable(error));
    return new Response(null, { status: 500 });
  }
}
