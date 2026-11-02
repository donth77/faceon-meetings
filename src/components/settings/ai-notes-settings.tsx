"use client";

import { Check, ChevronDown, ExternalLink, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Radio,
  RadioGroup,
  TextField,
} from "react-aria-components";

import { INPUT, RadioDot, SelectField } from "@/components/schedule/fields";
import { useOnDeviceModel } from "@/hooks/use-on-device-model";
import { preferredEngine, providerChoice, testKey } from "@/lib/notes/engines";
import { ENGINES, type EngineId } from "@/lib/notes/notes";
import {
  defaultModel,
  PROVIDER_INFO,
  ProviderError,
  PROVIDERS,
  type ProviderFailure,
  type ProviderId,
} from "@/lib/notes/providers";
import {
  saveForProvider,
  saveNotesSettings,
  useNotesSettings,
} from "@/lib/notes/settings";

import { SectionTitle, SettingsCard } from "./settings-nav";

const OUTLINE_BUTTON =
  "focus-visible:ring-ring flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#c9cfd8] px-4 text-sm font-semibold outline-none hover:bg-black/[0.03] focus-visible:ring-2 disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/5";

/** The model to ask for: one of the provider's, or any ID it offers, typed in. */
function ModelField({
  provider,
  model,
}: {
  provider: ProviderId;
  model: string;
}) {
  const t = useTranslations("Settings.aiNotes");
  const [draft, setDraft] = useState(model);
  const recommended = defaultModel(provider);
  const options = PROVIDER_INFO[provider].models.map((id) => ({
    id,
    label: id === recommended ? t("recommended", { model: id }) : id,
  }));

  function save(value: string) {
    setDraft(value);
    const trimmed = value.trim();
    if (trimmed) {
      saveForProvider(
        "models",
        provider,
        trimmed === recommended ? "" : trimmed,
      );
    }
  }

  return (
    <ComboBox
      allowsCustomValue
      inputValue={draft}
      onInputChange={save}
      onBlur={() => {
        // Left empty, it goes back to the recommended model.
        if (!draft.trim()) save(recommended);
      }}
      defaultItems={options}
      menuTrigger="focus"
      className="flex min-w-0 flex-col gap-1.5"
    >
      <Label className="text-sm font-semibold">{t("model")}</Label>
      <div className="relative">
        <Input
          spellCheck={false}
          autoComplete="off"
          className={`${INPUT} pr-10 font-mono text-[15px]`}
        />
        <Button className="text-muted-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center outline-none">
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <span className="text-muted-foreground text-[13px]">
        {t("modelHelp")}
      </span>
      <Popover
        placement="bottom start"
        className="bg-popover text-popover-foreground max-h-80 w-(--trigger-width) overflow-auto rounded-xl p-1.5 shadow-[0_16px_40px_rgba(18,22,28,0.18)] ring-1 ring-black/10 outline-none dark:ring-white/10"
      >
        <ListBox className="outline-none">
          {(option: { id: string; label: string }) => (
            <ListBoxItem
              id={option.id}
              textValue={option.id}
              className="data-focused:bg-accent data-selected:text-primary flex min-h-10 cursor-default items-center rounded-lg px-2.5 font-mono text-[15px] outline-none data-selected:font-semibold"
            >
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}

type KeyTest =
  | { state: "idle" | "testing" | "works" }
  | { state: "failed"; failure: ProviderFailure; detail: string };

/** The provider's API key, shown on request, with Test key. */
function KeyField({
  provider,
  model,
  value,
}: {
  provider: ProviderId;
  model: string;
  value: string;
}) {
  const t = useTranslations("Settings.aiNotes");
  const tf = useTranslations("Notes.failed");
  const [shown, setShown] = useState(false);
  const [test, setTest] = useState<KeyTest>({ state: "idle" });
  const name = PROVIDER_INFO[provider].name;

  async function runTest() {
    setTest({ state: "testing" });
    try {
      await testKey({ provider, model, key: value });
      setTest({ state: "works" });
    } catch (error) {
      setTest(
        error instanceof ProviderError
          ? { state: "failed", failure: error.failure, detail: error.detail }
          : { state: "failed", failure: "other", detail: "" },
      );
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <TextField
        value={value}
        onChange={(next) => {
          setTest({ state: "idle" });
          saveForProvider("keys", provider, next);
        }}
        className="flex min-w-0 flex-col gap-1.5"
      >
        <Label className="text-sm font-semibold">{t("key")}</Label>
        <div className="relative">
          <Input
            type={shown ? "text" : "password"}
            spellCheck={false}
            autoComplete="off"
            placeholder={t("keyPlaceholder", { provider: name })}
            className={`${INPUT} pr-20 font-mono text-[15px]`}
          />
          <Button
            onPress={() => setShown((now) => !now)}
            className="text-primary focus-visible:ring-ring absolute inset-y-1.5 right-1.5 rounded-lg px-2.5 text-sm font-semibold outline-none hover:bg-black/[0.03] focus-visible:ring-2 dark:hover:bg-white/5"
          >
            {shown ? t("hide") : t("show")}
          </Button>
        </div>
      </TextField>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          isDisabled={!value}
          isPending={test.state === "testing"}
          onPress={() => void runTest()}
          className={OUTLINE_BUTTON}
        >
          {test.state === "testing" ? t("testing") : t("test")}
        </Button>
        <a
          href={PROVIDER_INFO[provider].keyUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary focus-visible:ring-ring flex items-center gap-1.5 rounded-md text-sm font-semibold outline-none hover:underline focus-visible:ring-2"
        >
          {t("getKey", { provider: name })}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>
      <p role="status" className="text-[13px] empty:hidden">
        {test.state === "works" ? (
          <span className="text-live flex items-center gap-1.5 font-semibold">
            <Check className="size-4" aria-hidden="true" />
            {t("works")}
          </span>
        ) : test.state === "failed" ? (
          <span className="text-destructive">
            {tf(test.failure, { provider: name })}
            {test.detail
              ? ` ${t("providerSaid", { detail: test.detail })}`
              : ""}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/**
 * Settings → AI notes, as in the mockup: how notes are made (on this computer, or with
 * your own AI key), and the key, which stays in this browser.
 */
export function AiNotesSettings() {
  const t = useTranslations("Settings.aiNotes");
  const settings = useNotesSettings();
  const onDevice = useOnDeviceModel();
  const engine = preferredEngine(settings, onDevice ?? "none");
  const { provider, model, key } = providerChoice(settings);

  const choices: Record<EngineId, { title: string; help: string }> = {
    onDevice: { title: t("onDevice"), help: t("onDeviceHelp") },
    ownKey: { title: t("ownKey"), help: t("ownKeyHelp") },
  };

  return (
    <>
      <SectionTitle title={t("title")} intro={t("intro")} />
      <SettingsCard title={t("how")}>
        <RadioGroup
          aria-label={t("how")}
          value={engine}
          onChange={(value) => {
            const chosen = ENGINES.find((id) => id === value);
            if (chosen) saveNotesSettings({ engine: chosen });
          }}
          className="flex flex-col gap-3"
        >
          {ENGINES.map((id) => (
            <Radio
              key={id}
              value={id}
              className="group bg-card data-focus-visible:ring-ring flex cursor-default items-start gap-3 rounded-xl p-4 ring-1 ring-[#e2e5ea] outline-none data-focus-visible:ring-2 data-selected:ring-2 data-selected:ring-[#1f5eff] dark:ring-white/10"
            >
              <RadioDot className="mt-0.5" />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] font-bold">
                  {choices[id].title}
                  {id === "onDevice" && onDevice ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${onDevice === "ready" ? "bg-live/15 text-live" : "bg-black/5 dark:bg-white/10"}`}
                    >
                      {t(`onDeviceState.${onDevice}`)}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground text-sm leading-normal">
                  {choices[id].help}
                </span>
              </span>
            </Radio>
          ))}
        </RadioGroup>
      </SettingsCard>
      {engine === "ownKey" ? (
        <SettingsCard title={t("yourKey")}>
          <div className="flex max-w-[480px] flex-col gap-4">
            <SelectField
              label={t("provider")}
              options={PROVIDERS.map((id) => ({
                id,
                label: PROVIDER_INFO[id].name,
              }))}
              value={provider}
              onChange={(value) => {
                const chosen = PROVIDERS.find((id) => id === value);
                if (chosen) saveNotesSettings({ provider: chosen });
              }}
            />
            <ModelField key={provider} provider={provider} model={model} />
            <KeyField
              key={`${provider}:${model}`}
              provider={provider}
              model={model}
              value={key}
            />
          </div>
          <div className="text-muted-foreground flex max-w-[64ch] flex-col gap-2 text-[13px] leading-normal">
            <p className="flex items-start gap-2">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {t("keyStays")}
            </p>
            <p>{t("freeTiers")}</p>
          </div>
        </SettingsCard>
      ) : null}
    </>
  );
}
