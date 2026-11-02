import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SavedNotesLoader } from "@/components/notes/saved-notes-loader";
import { requireSession } from "@/lib/auth/session";
import { savedNotesFor } from "@/lib/meetings/saved-notes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Notes");
  return { title: t("title") };
}

export default function SavedNotesPage({
  params,
}: PageProps<"/[locale]/previous/[sessionId]/notes">) {
  return (
    <main className="flex flex-1 flex-col p-6 md:p-10">
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <Notes params={params} />
      </Suspense>
    </main>
  );
}

/** Saved AI notes, for whoever saved them, the host, and attendees once shared. */
async function Notes({
  params,
}: Pick<PageProps<"/[locale]/previous/[sessionId]/notes">, "params">) {
  const { sessionId } = await params;
  const session = await requireSession(`/previous/${sessionId}/notes`);
  const notes = await savedNotesFor(sessionId, session.user.id);
  if (!notes) notFound();
  return <SavedNotesLoader notes={notes} />;
}
