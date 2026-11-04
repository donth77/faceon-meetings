import { getTranslations } from "next-intl/server";

import { getSession } from "@/lib/auth/session";
import { emailLocale } from "@/lib/email/templates";
import { attendanceRows } from "@/lib/exports/attendance";
import { hostAttendance } from "@/lib/exports/attendance-data";
import { toCsv } from "@/lib/exports/csv";
import { attachment, fileName, spreadsheetDay } from "@/lib/exports/format";
import { attendanceLabels } from "@/lib/exports/labels";
import { reportError } from "@/lib/monitoring/report";
import { isSameOrigin } from "@/lib/same-origin";
import { isTimeZone } from "@/lib/time";

/**
 * GET /api/history/{sessionId}/attendance?tz=…: who came to a past meeting, as a CSV for
 * its host (like Meet's attendance report): names, how they joined, first join and last
 * leave in the reader's time zone, minutes and how often they joined. Email addresses
 * only for people the host invited, and the host's own. Anyone else gets 404.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/history/[sessionId]/attendance">,
) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  try {
    const { sessionId } = await params;
    const zone = new URL(request.url).searchParams.get("tz");
    const timeZone = isTimeZone(zone) ? zone : "UTC";
    const attendance = await hostAttendance(sessionId, session.user);
    if (!attendance) return new Response(null, { status: 404 });

    const locale = emailLocale(session.user);
    const [labels, t, tp] = await Promise.all([
      attendanceLabels(locale, timeZone),
      getTranslations({ locale, namespace: "Exports" }),
      getTranslations({ locale, namespace: "Previous" }),
    ]);
    const { meeting, session: past, hostName } = attendance.session;
    const csv = toCsv(
      attendanceRows({
        people: attendance.people,
        hostMediaId: attendance.hostMediaId,
        emailOf: (mediaUserId) => attendance.emails.get(mediaUserId) ?? null,
        timeZone,
        labels,
      }),
    );
    const name = fileName(
      t("attendanceFile", {
        title: meeting.title ?? tp("untitled", { name: hostName }),
        date: spreadsheetDay(past.startedAt, timeZone),
      }),
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": attachment(`${name}.csv`),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    reportError("Attendance download failed", error);
    return new Response(null, { status: 500 });
  }
}
