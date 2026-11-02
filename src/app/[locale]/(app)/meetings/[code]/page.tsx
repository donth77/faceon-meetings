import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MeetingDetailsLoader } from "@/components/schedule/meeting-details-loader";
import { requireSession } from "@/lib/auth/session";
import { meetingDetails } from "@/lib/meetings/scheduling";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MeetingDetails");
  return { title: t("pageTitle") };
}

export default function MeetingPage({
  params,
}: PageProps<"/[locale]/meetings/[code]">) {
  return (
    <main className="flex flex-1 flex-col p-6 md:p-10">
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <Details params={params} />
      </Suspense>
    </main>
  );
}

/** A scheduled meeting, for its host or someone invited to it. */
async function Details({
  params,
}: Pick<PageProps<"/[locale]/meetings/[code]">, "params">) {
  const { code } = await params;
  const session = await requireSession(`/meetings/${code}`);
  const details = await meetingDetails({ code, viewer: session.user });
  if (!details) notFound();
  return <MeetingDetailsLoader details={details} />;
}
