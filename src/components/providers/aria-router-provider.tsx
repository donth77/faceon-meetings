"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { RouterProvider } from "react-aria-components";

type RouterPushOptions = NonNullable<
  Parameters<ReturnType<typeof useRouter>["push"]>[1]
>;

declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: RouterPushOptions;
  }
}

/** Lets React Aria links (sidebar, menus) navigate with Next.js's client router. */
export function AriaRouterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <RouterProvider navigate={(href, options) => router.push(href, options)}>
      {children}
    </RouterProvider>
  );
}
