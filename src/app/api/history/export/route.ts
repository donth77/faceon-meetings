import { getTranslations } from "next-intl/server";

import { getSession } from "@/lib/auth/session";
import { emailLocale } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { attachment, fileName, spreadsheetDay } from "@/lib/exports/format";
import { historyData } from "@/lib/exports/history-data";
import { historyFiles } from "@/lib/exports/history-files";
import { historyLabels } from "@/lib/exports/labels";
import { exportLimits } from "@/lib/exports/limits";
import { zipStream } from "@/lib/exports/zip";
import { reportError } from "@/lib/monitoring/report";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/same-origin";
import { isTimeZone } from "@/lib/time";

/**
 * GET /api/history/export?tz=…: Previous's "Download history", like Google Takeout's Meet
 * history. A zip of the meetings from the last 90 days (history.csv), who came to the ones
 * you hosted (attendance.csv) and the AI notes you can read with their transcripts, made
 * on request and streamed. It shares Download your data's budget per account.
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
      historyData(session.user),
      historyLabels({ locale, timeZone, reader: session.user, now }),
      getTranslations({ locale, namespace: "Exports" }),
    ]);
    const name = fileName(
      t("historyFile", {
        appName: publicEnv.NEXT_PUBLIC_APP_NAME,
        date: spreadsheetDay(now, timeZone),
      }),
    );
    return new Response(zipStream(historyFiles(data, { labels, timeZone })), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": attachment(`${name}.zip`),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    reportError("History download failed", error);
    return new Response(null, { status: 500 });
  }
}
