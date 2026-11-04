import { getTranslations } from "next-intl/server";

import { getSession } from "@/lib/auth/session";
import { emailLocale } from "@/lib/email/templates";
import { attachment, fileName, spreadsheetDay } from "@/lib/exports/format";
import { meetingWhen, notesLabels } from "@/lib/exports/labels";
import { savedNotesFor } from "@/lib/meetings/saved-notes";
import { reportError } from "@/lib/monitoring/report";
import { notesMarkdown } from "@/lib/notes/notes";
import { isSameOrigin } from "@/lib/same-origin";
import { isTimeZone } from "@/lib/time";

/**
 * GET /api/history/{sessionId}/notes?tz=…: a past meeting's saved AI notes as Markdown,
 * with the transcript where it was saved with them, for whoever may read them (whoever
 * saved them, the host, and everyone who was there once they're shared). Anyone else
 * gets 404.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/history/[sessionId]/notes">,
) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  try {
    const { sessionId } = await params;
    const saved = await savedNotesFor(sessionId, session.user.id);
    if (!saved) return new Response(null, { status: 404 });

    const zone = new URL(request.url).searchParams.get("tz");
    const timeZone = isTimeZone(zone) ? zone : "UTC";
    const locale = emailLocale(session.user);
    const [labels, t, tp] = await Promise.all([
      notesLabels(locale),
      getTranslations({ locale, namespace: "Exports" }),
      getTranslations({ locale, namespace: "Previous" }),
    ]);
    const title = saved.title ?? tp("untitled", { name: saved.hostName });
    const markdown = notesMarkdown({
      title,
      when: meetingWhen(locale, timeZone)(saved.start, saved.end),
      notes: saved.notes,
      transcript: saved.transcript ?? "",
      labels,
    });
    const name = fileName(
      t("notesFile", { title, date: spreadsheetDay(saved.start, timeZone) }),
    );
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": attachment(`${name}.md`),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    reportError("AI notes download failed", error);
    return new Response(null, { status: 500 });
  }
}
