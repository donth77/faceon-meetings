import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { legalDocument } from "@/lib/content/legal";

export async function generateMetadata(): Promise<Metadata> {
  const document = await legalDocument("privacy");
  return { title: document.title };
}

export default async function Page() {
  return <LegalPage document={await legalDocument("privacy")} />;
}
