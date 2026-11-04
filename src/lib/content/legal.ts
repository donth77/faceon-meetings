import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { hasLocale, type Locale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
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
  /** Whether this is a translation; the English version is the one that binds. */
  translated: boolean;
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

/** The words a document's placeholders turn into, in its language (messages: Legal.fill). */
export type LegalPhrase =
  | "unnamedOperator"
  | "contactEmail"
  | "contactIssues"
  | "contactSite"
  | "lawsOf"
  | "lawsWhereBased";
export type LegalPhrases = (
  phrase: LegalPhrase,
  values?: Record<string, string>,
) => string;

/** How to reach whoever runs this copy, as Markdown ending a sentence. */
function contact({ email, repoUrl }: Operator, phrases: LegalPhrases): string {
  if (email) return phrases("contactEmail", { email });
  if (repoUrl) {
    return phrases("contactIssues", {
      url: `${repoUrl.replace(/\/$/, "")}/issues`,
    });
  }
  return phrases("contactSite");
}

/**
 * A document's placeholders, filled in for this copy: {appName}, {siteUrl}, {operator},
 * {contact} and {governingLaw}. A copy that hasn't named its operator or jurisdiction
 * still reads correctly, without claiming either.
 */
export function fillPlaceholders(
  raw: string,
  operator: Operator,
  phrases: LegalPhrases,
): string {
  const name =
    operator.name ?? phrases("unnamedOperator", { appName: operator.appName });
  return raw
    .replaceAll("{appName}", operator.appName)
    .replaceAll("{siteUrl}", operator.site)
    .replaceAll("{operator}", name)
    .replaceAll("{contact}", contact(operator, phrases))
    .replaceAll(
      "{governingLaw}",
      operator.jurisdiction
        ? phrases("lawsOf", { jurisdiction: operator.jurisdiction })
        : phrases("lawsWhereBased", { operator: name }),
    );
}

/**
 * A document as written, placeholders and all: content/legal/<name>.md in English, and
 * a translation in content/legal/<locale>/<name>.md.
 */
export function readLegalSource(
  name: LegalDocumentName,
  locale = "en",
): Promise<string> {
  const folder = path.join(process.cwd(), "content", "legal");
  return readFile(
    locale === "en"
      ? path.join(folder, `${name}.md`)
      : path.join(folder, locale, `${name}.md`),
    "utf8",
  );
}

/**
 * A document in a language: its translation when there's one as new as the English
 * version (a translation left behind by a change shows English instead), and the
 * English version otherwise.
 */
async function sourceIn(
  name: LegalDocumentName,
  locale: string,
): Promise<{ source: string; locale: Locale }> {
  const english = await readLegalSource(name);
  if (!hasLocale(routing.locales, locale) || locale === routing.defaultLocale) {
    return { source: english, locale: routing.defaultLocale };
  }
  const updated = (source: string) =>
    parseFrontMatter(source).fields.get("updated");
  try {
    const translation = await readLegalSource(name, locale);
    if (updated(translation) === updated(english)) {
      return { source: translation, locale };
    }
  } catch {
    // Not translated.
  }
  return { source: english, locale: routing.defaultLocale };
}

/**
 * The privacy policy, the terms or the credits, from content/legal, in a language. They
 * name this copy's site, operator, contact and jurisdiction, so a self-hosted copy
 * speaks for itself.
 */
export async function legalDocument(
  name: LegalDocumentName,
  locale: string,
): Promise<LegalDocument> {
  "use cache";
  const document = await sourceIn(name, locale);
  const t = await getTranslations({
    locale: document.locale,
    namespace: "Legal.fill",
  });
  const { fields, body } = parseFrontMatter(
    fillPlaceholders(
      document.source,
      {
        appName: publicEnv.NEXT_PUBLIC_APP_NAME,
        site: new URL(siteUrl()).host,
        name: publicEnv.NEXT_PUBLIC_OPERATOR_NAME,
        email: publicEnv.NEXT_PUBLIC_CONTACT_EMAIL,
        repoUrl: publicEnv.NEXT_PUBLIC_REPO_URL,
        jurisdiction: publicEnv.NEXT_PUBLIC_OPERATOR_JURISDICTION,
      },
      (phrase, values) => t(phrase, values),
    ),
  );
  return {
    title: fields.get("title") ?? name,
    updated: fields.get("updated") ?? "",
    body,
    translated: document.locale !== routing.defaultLocale,
  };
}
