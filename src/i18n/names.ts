/** A language's name in that language ("Deutsch", "Español", "日本語"), capitalized. */
export function nativeName(locale: string): string {
  const name =
    new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

/** A new GitHub issue for suggesting better wording in a language. */
export function translationIssueUrl(repoUrl: string, locale: string): string {
  const title = `Translation (${nativeName(locale)}): `;
  return `${repoUrl.replace(/\/$/, "")}/issues/new?labels=translation&title=${encodeURIComponent(title)}`;
}
