import { APP_NAME, FACEON_URL } from "./config";
import { textFor, type AddonEvent } from "./i18n";

/** The sidebar's homepage (addOns.common.homepageTrigger). The spike's: a way to FaceOn. */
export function onHomepage(
  event: AddonEvent,
): GoogleAppsScript.Card_Service.Card {
  const t = textFor(event);
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(APP_NAME))
    .addSection(
      CardService.newCardSection().addWidget(
        CardService.newTextButton()
          .setText(t("home.open"))
          .setOpenLink(CardService.newOpenLink().setUrl(`${FACEON_URL}/home`)),
      ),
    )
    .build();
}
