import { api } from "./api";
import { composeCard, errorCard } from "./cards";
import { inputOf, localeOf, textFor, type AddonEvent } from "./i18n";
import { pushCard, render } from "./render";

/**
 * Gmail's compose window: "Insert a FaceOn meeting" (gmail.composeTrigger). It never
 * reads the draft (draftAccess NONE); it only adds the invitation where the cursor is.
 */
export function onCompose(
  event: AddonEvent,
): GoogleAppsScript.Card_Service.Card {
  return render(composeCard(textFor(event)));
}

export function onComposeInsert(
  event: AddonEvent,
):
  | GoogleAppsScript.Card_Service.UpdateDraftActionResponse
  | GoogleAppsScript.Card_Service.ActionResponse {
  const t = textFor(event);
  const which =
    inputOf(event, "which") === "personalRoom" ? "personalRoom" : "new";
  const title = inputOf(event, "title").trim();
  const result = api.meeting({
    kind: which,
    locale: localeOf(event),
    ...(which === "new" && title ? { title } : {}),
  });
  if (!result.ok) return pushCard(errorCard(t, result.error));
  return CardService.newUpdateDraftActionResponseBuilder()
    .setUpdateDraftBodyAction(
      CardService.newUpdateDraftBodyAction()
        .addUpdateContent(
          `${result.data.invitation}\n`,
          CardService.ContentType.TEXT,
        )
        .setUpdateType(CardService.UpdateDraftBodyType.IN_PLACE_INSERT),
    )
    .build();
}
