import { AppFrame } from "@/components/app-shell/app-frame";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getSession } from "@/lib/auth/session";

// Help waits for the session (it decides the frame) before sending anything, so an
// address that isn't an article can answer with a real 404.
export const instant = false;

/** Help: inside the app (with the sidebar) when signed in, a public page otherwise. */
export default async function HelpLayout({
  children,
}: LayoutProps<"/[locale]/help">) {
  const session = await getSession();
  if (session) return <AppFrame session={session}>{children}</AppFrame>;
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="flex flex-1 justify-center">{children}</div>
      <SiteFooter />
    </div>
  );
}
