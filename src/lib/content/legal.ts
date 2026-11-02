import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { publicEnv } from "@/lib/env";
import { siteUrl } from "@/lib/site";

import { parseFrontMatter } from "./front-matter";

export type LegalDocument = {
  title: string;
  /** When it last changed, as YYYY-MM-DD. */
  updated: string;
  body: string;
};

/** How to reach whoever runs this copy, as Markdown. */
function contact(): string {
  const email = publicEnv.NEXT_PUBLIC_CONTACT_EMAIL;
  if (email) return `email [${email}](mailto:${email}).`;
  const repo = publicEnv.NEXT_PUBLIC_REPO_URL;
  if (repo)
    return `open an issue on [GitHub](${repo.replace(/\/$/, "")}/issues).`;
  return "use the contact details on this site.";
}

/**
 * The privacy policy or the terms, from content/legal. They name this copy's site,
 * operator and contact, so a self-hosted copy speaks for itself.
 */
export async function legalDocument(
  name: "privacy" | "terms",
): Promise<LegalDocument> {
  "use cache";
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const raw = await readFile(
    path.join(process.cwd(), "content", "legal", `${name}.md`),
    "utf8",
  );
  const { fields, body } = parseFrontMatter(
    raw
      .replaceAll("{appName}", appName)
      .replaceAll("{siteUrl}", new URL(siteUrl()).host)
      .replaceAll(
        "{operator}",
        publicEnv.NEXT_PUBLIC_OPERATOR_NAME ?? `${appName}'s operator`,
      )
      .replaceAll("{contact}", contact()),
  );
  return {
    title: fields.get("title") ?? name,
    updated: fields.get("updated") ?? "",
    body,
  };
}
