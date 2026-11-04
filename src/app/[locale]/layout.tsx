import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { notFound } from "next/navigation";

import { AriaRouterProvider } from "@/components/providers/aria-router-provider";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { ShortcutsProvider } from "@/components/shortcuts/shortcuts-dialog";
import { ThemeProvider } from "@/components/theme-provider";
import { routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";

import "../globals.css";

// `subsets` are the ones preloaded: Latin covers every language FaceOn ships (but
// Japanese, which uses the system's fonts). The other subsets still load, on the pages
// that use their letters (a name like "Łukasz").
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
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
    // Installed on an iPhone or iPad (Add to Home Screen): a window of its own, named
    // FaceOn, under an ordinary status bar. Meeting IDs aren't phone numbers.
    appleWebApp: { capable: true, title: appName, statusBarStyle: "default" },
    formatDetection: { telephone: false },
    ...(publicEnv.NEXT_PUBLIC_APP_URL
      ? { metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL) }
      : {}),
  };
}

export const viewport: Viewport = {
  // Edge to edge on phones with a notch or a home bar; bars and controls keep clear of
  // them with env(safe-area-inset-*).
  viewportFit: "cover",
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
            <AriaRouterProvider>
              <ShortcutsProvider>{children}</ShortcutsProvider>
            </AriaRouterProvider>
          </NextIntlClientProvider>
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
