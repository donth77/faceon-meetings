"use client";

import { cn } from "cn";
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
import { toast } from "sonner";

import { SpeechDownload } from "@/components/notes/speech-download";
import {
  FIELD_POPOVER,
  INPUT,
  RadioDot,
  SelectField,
  SwitchRow,
} from "@/components/ui/form-fields";
import { NewTabNote } from "@/components/ui/new-tab-note";
import { useOnDeviceModel } from "@/hooks/use-on-device-model";
import { useSpeechLanguage } from "@/hooks/use-speech-language";
import { setNotesInMeetingsAction } from "@/lib/account/actions";
import { publicEnv } from "@/lib/env";
import {
  onDeviceUsable,
  preferredEngine,
  providerChoice,
  testKey,
} from "@/lib/notes/engines";
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
import { useSpeechSetup } from "@/lib/notes/speech-setup";

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
        className={cn(
          FIELD_POPOVER,
          "max-h-80 w-(--trigger-width) overflow-auto",
        )}
      >
        <ListBox className="outline-none">
          {(option: { id: string; label: string }) => (
            <ListBoxItem
              id={option.id}
              textValue={option.id}
              className="data-focused:bg-accent data-focus-visible:focus-ring-inset data-selected:text-chip-foreground flex min-h-10 items-center rounded-lg px-2.5 font-mono text-[15px] outline-hidden data-selected:font-semibold"
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
          <NewTabNote />
        </a>
      </div>
      <p role="status" className="text-[13px] empty:sr-only">
        {test.state === "works" ? (
          <span className="text-live-text flex items-center gap-1.5 font-semibold">
            <Check className="size-4" aria-hidden="true" />
            {t("works")}
          </span>
        ) : test.state === "failed" ? (
          <span className="text-destructive-text">
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
/**
 * Whether meetings you host offer AI notes. It's kept with your account, so it holds for
 * your co-hosts too; in a meeting you host, `allowed` follows the meeting as it changes.
 */
function NotesInMeetings({ allowed }: { allowed: boolean }) {
  const t = useTranslations("Settings.aiNotes");
  const [value, setValue] = useState(allowed);
  // A new value from outside (the meeting, say) replaces what's shown.
  const [given, setGiven] = useState(allowed);
  if (allowed !== given) {
    setGiven(allowed);
    setValue(allowed);
  }

  async function change(next: boolean) {
    setValue(next);
    const saved = await setNotesInMeetingsAction(next).catch(() => false);
    if (!saved) {
      setValue(!next);
      toast.error(t("inMeetingsFailed"));
    }
  }

  return (
    <SettingsCard title={t("inMeetingsTitle")}>
      <SwitchRow
        label={t("inMeetings")}
        help={t("inMeetingsHelp")}
        isSelected={value}
        onChange={(next) => void change(next)}
      />
    </SettingsCard>
  );
}

/**
 * Transcription on this device, in browsers that can do it now or after the one-time
 * download (which is done here); others never see it.
 */
function SpeechCard() {
  const t = useTranslations("Settings.aiNotes");
  const state = useSpeechSetup(useSpeechLanguage());
  if (state === "checking" || state === "unavailable") return null;
  return (
    <SettingsCard title={t("speechTitle")}>
      <SpeechDownload place="settings" />
    </SettingsCard>
  );
}

/**
 * Settings → AI notes. `notesInMeetings` is the account's switch for meetings you host:
 * left out where it doesn't apply (a meeting someone else hosts).
 */
export function AiNotesSettings({
  notesInMeetings,
}: {
  notesInMeetings?: boolean | undefined;
}) {
  const t = useTranslations("Settings.aiNotes");
  const tn = useTranslations("Notes");
  const settings = useNotesSettings();
  const onDevice = useOnDeviceModel();
  const engine = preferredEngine(settings, onDevice ?? "none");
  // Chrome's built-in AI is a choice only where it can run (or download, here), or where
  // it's the host's choice already, so they can change it.
  const offersOnDevice =
    onDevice === null ||
    onDeviceUsable(onDevice) ||
    settings.engine === "onDevice";
  const { provider, model, key } = providerChoice(settings);

  const choices: Record<EngineId, { title: string; help: string }> = {
    onDevice: { title: t("onDevice"), help: t("onDeviceHelp") },
    ownKey: {
      title: t("ownKey"),
      help: t("ownKeyHelp", { appName: publicEnv.NEXT_PUBLIC_APP_NAME }),
    },
  };

  return (
    <>
      <SectionTitle title={t("title")} intro={t("intro")} />
      {notesInMeetings === undefined ? null : (
        <NotesInMeetings allowed={notesInMeetings} />
      )}
      <SpeechCard />
      <SettingsCard title={t("how")}>
        {offersOnDevice ? (
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
                className="group bg-card ring-border data-selected:ring-primary data-focus-visible:focus-ring-strong flex items-start gap-3 rounded-xl p-4 ring-1 outline-hidden data-selected:ring-2"
              >
                <RadioDot className="mt-0.5" showFocus={false} />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] font-bold">
                    {choices[id].title}
                    {id === "onDevice" && onDevice ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${onDevice === "ready" ? "bg-live/15 text-live-text" : "bg-black/5 dark:bg-white/10"}`}
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
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-bold">{choices.ownKey.title}</p>
            <p className="text-muted-foreground max-w-[64ch] text-sm leading-normal">
              {choices.ownKey.help}
            </p>
            {onDevice === "update" ||
            onDevice === "enable" ||
            onDevice === "none" ? (
              <p className="text-muted-foreground mt-2 max-w-[64ch] text-[13px] leading-normal">
                {tn(`elsewhere.${onDevice}`)}
              </p>
            ) : null}
          </div>
        )}
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
              {t("keyStays", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
            </p>
            <p>{t("freeTiers")}</p>
          </div>
        </SettingsCard>
      ) : null}
    </>
  );
}
