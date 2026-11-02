type Source = {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnail: string | null;
  icon: string | null;
};

type PickerApi = {
  platform: string;
  sources(): Promise<Source[]>;
  choose(id: string, sound: boolean): void;
  cancel(): void;
};

const api = (window as unknown as { picker: PickerApi }).picker;
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const tabs = {
  screen: element<HTMLButtonElement>("tab-screen"),
  window: element<HTMLButtonElement>("tab-window"),
};
const panel = element<HTMLDivElement>("panel");
const list = element<HTMLDivElement>("sources");
const empty = element<HTMLParagraphElement>("empty");
const share = element<HTMLButtonElement>("share");
const sound = element<HTMLInputElement>("sound");

let kind: Source["kind"] = "screen";
let sources: Source[] = [];
let chosen: string | null = null;

// Only Windows can share the computer's sound with a screen or window.
element<HTMLLabelElement>("sound-row").hidden = api.platform !== "win32";

function render(focusChosen = false) {
  const shown = sources.filter((source) => source.kind === kind);
  if (chosen && !shown.some((source) => source.id === chosen)) chosen = null;
  list.replaceChildren(
    ...shown.map((source, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "source";
      option.setAttribute("role", "radio");
      option.setAttribute("aria-checked", String(source.id === chosen));
      option.tabIndex =
        source.id === chosen || (!chosen && index === 0) ? 0 : -1;
      option.dataset.id = source.id;
      if (source.thumbnail) {
        const image = document.createElement("img");
        image.className = "thumbnail";
        image.alt = "";
        image.src = source.thumbnail;
        option.append(image);
      }
      const name = document.createElement("span");
      name.className = "name";
      if (source.icon) {
        const icon = document.createElement("img");
        icon.alt = "";
        icon.src = source.icon;
        name.append(icon);
      }
      name.append(source.name);
      option.append(name);
      option.addEventListener("click", () => select(source.id));
      option.addEventListener("dblclick", () => {
        select(source.id);
        api.choose(source.id, sound.checked);
      });
      return option;
    }),
  );
  empty.hidden = shown.length > 0;
  share.disabled = chosen === null;
  if (focusChosen) {
    list.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }
}

function select(id: string) {
  chosen = id;
  render(true);
}

function showTab(next: Source["kind"]) {
  kind = next;
  for (const [name, tab] of Object.entries(tabs)) {
    const selected = name === next;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  panel.setAttribute("aria-labelledby", tabs[next].id);
  list.setAttribute("aria-labelledby", tabs[next].id);
  render();
}

tabs.screen.addEventListener("click", () => showTab("screen"));
tabs.window.addEventListener("click", () => showTab("window"));
for (const tab of Object.values(tabs)) {
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const next = kind === "screen" ? "window" : "screen";
    showTab(next);
    tabs[next].focus();
  });
}

list.addEventListener("keydown", (event) => {
  const options = [...list.querySelectorAll<HTMLButtonElement>(".source")];
  const at = options.indexOf(document.activeElement as HTMLButtonElement);
  if (at < 0) return;
  const step =
    event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
  if (step === 0) return;
  event.preventDefault();
  const target = options[(at + step + options.length) % options.length];
  if (target?.dataset.id) select(target.dataset.id);
});

share.addEventListener("click", () => {
  if (chosen) api.choose(chosen, sound.checked);
});
element<HTMLButtonElement>("cancel").addEventListener("click", () =>
  api.cancel(),
);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") api.cancel();
});

async function refresh() {
  try {
    sources = await api.sources();
    render();
  } catch {
    // The picker is closing.
  }
}

void refresh().then(() =>
  list.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus(),
);
setInterval(() => void refresh(), 3000);
