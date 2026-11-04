import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { legalDocument } from "@/lib/content/legal";
import { languageAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/credits">): Promise<Metadata> {
  const { locale } = await params;
  const document = await legalDocument("credits", locale);
  return {
    title: document.title,
    alternates: languageAlternates("/credits", locale),
  };
}

export default async function Page({ params }: PageProps<"/[locale]/credits">) {
  const { locale } = await params;
  return (
    <LegalPage
      document={await legalDocument("credits", locale)}
      path="/credits"
      binding={false}
    />
  );
}
