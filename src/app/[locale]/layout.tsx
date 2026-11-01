import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { notFound } from "next/navigation";

import { AriaRouterProvider } from "@/components/providers/aria-router-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";

import "../globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
});

const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
    namespace: "Metadata",
  });
  return {
    title: { default: appName, template: `%s · ${appName}` },
    description: t("description"),
    applicationName: appName,
    ...(publicEnv.NEXT_PUBLIC_APP_URL
      ? { metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL) }
      : {}),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${figtree.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider>
            <AriaRouterProvider>{children}</AriaRouterProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
