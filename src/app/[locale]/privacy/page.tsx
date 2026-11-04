import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { legalDocument } from "@/lib/content/legal";
import { languageAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  const document = await legalDocument("privacy", locale);
  return {
    title: document.title,
    alternates: languageAlternates("/privacy", locale),
  };
}

export default async function Page({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  return (
    <LegalPage
      document={await legalDocument("privacy", locale)}
      path="/privacy"
      binding={true}
    />
  );
}
