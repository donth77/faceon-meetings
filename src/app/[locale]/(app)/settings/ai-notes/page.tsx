import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PanelLoading } from "@/components/app-shell/loading";
import { SettingsLoader } from "@/components/settings/settings-loader";
import { requireSession } from "@/lib/auth/session";
import { aiNotesEnabled } from "@/lib/env";
import { notesAllowedFor } from "@/lib/meetings/notes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: t("section.aiNotes") };
}

export default function Page() {
  if (!aiNotesEnabled) notFound();
  return (
    <Suspense fallback={<PanelLoading height="h-72" />}>
      <AiNotes />
    </Suspense>
  );
}

/**
 * Settings → AI notes, with the account's switch for meetings you host, read from the
 * database (the session's copy of the account can lag behind it).
 */
async function AiNotes() {
  const session = await requireSession("/settings/ai-notes");
  const allowed = await notesAllowedFor(session.user.id);
  return <SettingsLoader section="aiNotes" notesInMeetings={allowed} />;
}
