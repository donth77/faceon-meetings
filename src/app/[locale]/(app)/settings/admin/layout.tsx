import { Suspense, type ReactNode } from "react";

import { CardsLoading } from "@/components/app-shell/loading";

/**
 * Settings → Admin's loading state. It's here rather than in the page because each of the
 * page's lists is paged in the address, and Next.js renders a page anew when its search
 * params change: a boundary in the page would flash back to loading on every Next page,
 * while this one keeps the page on screen until the next one is ready.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<CardsLoading rows={3} />}>{children}</Suspense>;
}
