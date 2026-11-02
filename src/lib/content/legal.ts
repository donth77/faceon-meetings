import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { publicEnv } from "@/lib/env";
import { siteUrl } from "@/lib/site";

import { parseFrontMatter } from "./front-matter";

/** The site's own documents: the privacy policy, the terms, and the credits. */
export type LegalDocumentName = "privacy" | "terms" | "credits";

export type LegalDocument = {
  title: string;
  /** When it last changed, as YYYY-MM-DD. */
  updated: string;
  body: string;
};

/** Who runs this copy, as the privacy policy and the terms name them. */
export type Operator = {
  appName: string;
  /** The site's host, like faceon.example. */
  site: string;
  name?: string;
  email?: string;
  repoUrl?: string;
  /** Whose laws govern the terms, like "the State of New York, USA". */
  jurisdiction?: string;
};

/** How to reach whoever runs this copy, as Markdown ending a sentence. */
function contact({ email, repoUrl }: Operator): string {
  if (email) return `email [${email}](mailto:${email}).`;
  if (repoUrl) {
    return `open an issue on [GitHub](${repoUrl.replace(/\/$/, "")}/issues).`;
  }
  return "use the contact details on this site.";
}

/**
 * A document's placeholders, filled in for this copy: {appName}, {siteUrl}, {operator},
 * {contact} and {governingLaw}. A copy that hasn't named its operator or jurisdiction
 * still reads correctly, without claiming either.
 */
export function fillPlaceholders(raw: string, operator: Operator): string {
  const name = operator.name ?? `${operator.appName}'s operator`;
  return raw
    .replaceAll("{appName}", operator.appName)
    .replaceAll("{siteUrl}", operator.site)
    .replaceAll("{operator}", name)
    .replaceAll("{contact}", contact(operator))
    .replaceAll(
      "{governingLaw}",
      operator.jurisdiction
        ? `the laws of ${operator.jurisdiction}`
        : `the laws of the place where ${name} is based`,
    );
}

/** A document as written in content/legal, placeholders and all. */
export function readLegalSource(name: LegalDocumentName): Promise<string> {
  return readFile(
    path.join(process.cwd(), "content", "legal", `${name}.md`),
    "utf8",
  );
}

/**
 * The privacy policy or the terms, from content/legal. They name this copy's site,
 * operator, contact and jurisdiction, so a self-hosted copy speaks for itself.
 */
export async function legalDocument(
  name: LegalDocumentName,
): Promise<LegalDocument> {
  "use cache";
  const { fields, body } = parseFrontMatter(
    fillPlaceholders(await readLegalSource(name), {
      appName: publicEnv.NEXT_PUBLIC_APP_NAME,
      site: new URL(siteUrl()).host,
      name: publicEnv.NEXT_PUBLIC_OPERATOR_NAME,
      email: publicEnv.NEXT_PUBLIC_CONTACT_EMAIL,
      repoUrl: publicEnv.NEXT_PUBLIC_REPO_URL,
      jurisdiction: publicEnv.NEXT_PUBLIC_OPERATOR_JURISDICTION,
    }),
  );
  return {
    title: fields.get("title") ?? name,
    updated: fields.get("updated") ?? "",
    body,
  };
}
