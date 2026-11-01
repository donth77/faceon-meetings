import { safeRedirectPath, VERIFY_EMAIL_ROUTE } from "@/lib/routes";

/**
 * Where an email verification link lands, carrying the page the person was headed to
 * (say, a meeting link) so they can continue there.
 */
export function verifyEmailCallback(next: string | null): string {
  return next
    ? `${VERIFY_EMAIL_ROUTE}?next=${encodeURIComponent(safeRedirectPath(next))}`
    : VERIFY_EMAIL_ROUTE;
}
