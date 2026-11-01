import type messages from "../../messages/en.json";
import type { routing } from "../i18n/routing";

// Type-checks message keys and locales across the app (English is the source).
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
