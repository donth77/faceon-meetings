import type { Action, Button, CardModel, Widget } from "./cards";

/** A card value (cards.ts) as a CardService card. */
export function render(model: CardModel): GoogleAppsScript.Card_Service.Card {
  const card = CardService.newCardBuilder()
    .setName(model.name)
    .setHeader(CardService.newCardHeader().setTitle(model.title));
  for (const section of model.sections) {
    const built = CardService.newCardSection();
    if (section.header) built.setHeader(section.header);
    for (const widget of section.widgets) built.addWidget(renderWidget(widget));
    card.addSection(built);
  }
  return card.build();
}

function renderWidget(widget: Widget): GoogleAppsScript.Card_Service.Widget {
  switch (widget.kind) {
    case "text":
      return CardService.newTextParagraph().setText(widget.text);
    case "item": {
      const item = CardService.newDecoratedText()
        .setText(widget.text)
        .setWrapText(true);
      if (widget.top) item.setTopLabel(widget.top);
      if (widget.bottom) item.setBottomLabel(widget.bottom);
      if (widget.button) item.setButton(renderButton(widget.button));
      return item;
    }
    case "buttons": {
      const set = CardService.newButtonSet();
      for (const button of widget.buttons) set.addButton(renderButton(button));
      return set;
    }
    case "input": {
      const input = CardService.newTextInput()
        .setFieldName(widget.name)
        .setTitle(widget.label)
        .setMultiline(widget.multiline ?? false);
      if (widget.hint) input.setHint(widget.hint);
      if (widget.value !== undefined) input.setValue(widget.value);
      return input;
    }
    case "choice": {
      const choice = CardService.newSelectionInput()
        .setType(CardService.SelectionInputType.RADIO_BUTTON)
        .setFieldName(widget.name)
        .setTitle(widget.label);
      for (const option of widget.options) {
        choice.addItem(option.text, option.value, option.selected);
      }
      return choice;
    }
  }
}

const STYLES = {
  filled: () => CardService.TextButtonStyle.FILLED,
  outlined: () => CardService.TextButtonStyle.OUTLINED,
  text: () => CardService.TextButtonStyle.TEXT,
};

function renderButton(
  button: Button,
): GoogleAppsScript.Card_Service.TextButton {
  const built = CardService.newTextButton()
    .setText(button.text)
    .setTextButtonStyle(STYLES[button.style ?? "text"]());
  return withAction(built, button.action);
}

function withAction(
  button: GoogleAppsScript.Card_Service.TextButton,
  action: Action,
): GoogleAppsScript.Card_Service.TextButton {
  if (action.kind === "open") return button.setOpenLink(openLink(action));
  const run = CardService.newAction().setFunctionName(action.handler);
  if (action.params) run.setParameters(action.params);
  return button.setOnClickAction(run);
}

export function openLink(
  action: Extract<Action, { kind: "open" }>,
): GoogleAppsScript.Card_Service.OpenLink {
  return CardService.newOpenLink()
    .setUrl(action.url)
    .setOpenAs(CardService.OpenAs.FULL_SIZE)
    .setOnClose(
      action.reloadOnClose
        ? CardService.OnClose.RELOAD
        : CardService.OnClose.NOTHING,
    );
}

/** Shows another card on top (Google adds the way back). */
export function pushCard(
  model: CardModel,
): GoogleAppsScript.Card_Service.ActionResponse {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(render(model)))
    .build();
}

/** Replaces the card on screen. */
export function updateCard(
  model: CardModel,
): GoogleAppsScript.Card_Service.ActionResponse {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(render(model)))
    .build();
}

/** A short message at the bottom of the sidebar. */
export function notify(
  text: string,
): GoogleAppsScript.Card_Service.ActionResponse {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(text))
    .build();
}

/** Opens a page, from a card action. */
export function openUrl(
  url: string,
): GoogleAppsScript.Card_Service.ActionResponse {
  return CardService.newActionResponseBuilder()
    .setOpenLink(openLink({ kind: "open", url }))
    .build();
}
