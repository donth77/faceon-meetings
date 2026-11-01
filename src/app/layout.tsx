import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";

import { publicEnv } from "@/lib/env";

import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
});

const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
  description:
    "Free, open-source video meetings in your browser. No downloads.",
  applicationName: appName,
  ...(publicEnv.NEXT_PUBLIC_APP_URL
    ? { metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL) }
    : {}),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
