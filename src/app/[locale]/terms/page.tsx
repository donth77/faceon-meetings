import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { legalDocument } from "@/lib/content/legal";
import { languageAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  const document = await legalDocument("terms", locale);
  return {
    title: document.title,
    alternates: languageAlternates("/terms", locale),
  };
}

export default async function Page({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  return (
    <LegalPage
      document={await legalDocument("terms", locale)}
      path="/terms"
      binding={true}
    />
  );
}
