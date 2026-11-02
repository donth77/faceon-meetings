import { FACEON_URL } from "./config";

/**
 * Calendar's settings → FaceOn opens FaceOn's own Settings → Calendar
 * (calendar.createSettingsUrlFunction).
 */
export function createSettingsUrl(): string {
  return `${FACEON_URL}/settings/calendar`;
}
