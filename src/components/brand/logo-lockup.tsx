import { cn } from "cn";
import Image from "next/image";

import { publicEnv } from "@/lib/env";

/** The logo with the name beside it, in its light or dark version to suit the theme. */
export function LogoLockup({ className }: { className?: string }) {
  const name = publicEnv.NEXT_PUBLIC_APP_NAME;
  return (
    <>
      <Image
        src="/brand/logo-lockup.svg"
        alt={name}
        width={979}
        height={224}
        className={cn("w-auto dark:hidden", className)}
      />
      <Image
        src="/brand/logo-lockup-dark.svg"
        alt={name}
        width={979}
        height={224}
        className={cn("hidden w-auto dark:block", className)}
      />
    </>
  );
}
