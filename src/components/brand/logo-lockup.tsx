import { cn } from "cn";
import Image from "next/image";

import { publicEnv } from "@/lib/env";

/**
 * The logo with the name beside it, in its light or dark version to suit the theme.
 * Loaded eagerly: it sits at the top of every page.
 */
export function LogoLockup({ className }: { className?: string }) {
  const name = publicEnv.NEXT_PUBLIC_APP_NAME;
  return (
    <>
      <Image
        src="/brand/logo-lockup.svg"
        alt={name}
        width={979}
        height={224}
        loading="eager"
        className={cn("w-auto dark:hidden", className)}
      />
      <Image
        src="/brand/logo-lockup-dark.svg"
        alt={name}
        width={979}
        height={224}
        loading="eager"
        className={cn("hidden w-auto dark:block", className)}
      />
    </>
  );
}

/**
 * Just the mark, for where the name doesn't fit (the public header on small phones), or
 * as decoration (`decorative`: no alt text) where the name is already on the page.
 */
export function LogoMark({
  className,
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  const name = decorative ? "" : publicEnv.NEXT_PUBLIC_APP_NAME;
  return (
    <>
      <Image
        src="/brand/logo-mark.svg"
        alt={name}
        width={256}
        height={256}
        loading="eager"
        className={cn("dark:hidden", className)}
      />
      <Image
        src="/brand/logo-mark-dark.svg"
        alt={name}
        width={256}
        height={256}
        loading="eager"
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}
