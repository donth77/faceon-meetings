"use client";

import { cn } from "cn";
import { Check, ChevronDown, ExternalLink, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type Ref } from "react";
import {
  Button,
  ComboBox,
  Disclosure,
  DisclosurePanel,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  TextField,
} from "react-aria-components";
import { toast } from "sonner";

import { EnglishNotesNotice } from "@/components/notes/english-notes-notice";
import { useNotesSentence } from "@/components/notes/notes-here";
import { SpeechDownload } from "@/components/notes/speech-download";
import { Button as UiButton } from "@/components/ui/button";
import {
  FIELD_POPOVER,
  INPUT,
  SelectField,
  SwitchRow,
} from "@/components/ui/form-fields";
import { NewTabNote } from "@/components/ui/new-tab-note";
import {
  useOnDeviceModel,
  useOnDeviceNotesInEnglish,
} from "@/hooks/use-on-device-model";
import { useSpeechLanguage } from "@/hooks/use-speech-language";
import { setNotesInMeetingsAction } from "@/lib/account/actions";
import { publicEnv } from "@/lib/env";
import { notesHere, providerChoice, testKey } from "@/lib/notes/engines";
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
  inputRef,
}: {
  provider: ProviderId;
  model: string;
  value: string;
  /** For notices that send the person to the key. */
  inputRef?: Ref<HTMLInputElement>;
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
            ref={inputRef}
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
 * Settings → AI notes: whether meetings you host offer AI notes (your account's switch, the
 * same in every browser), and an optional AI key, kept in this browser, with one sentence
 * on what happens here. No key: free, on this computer, where Chrome's AI runs; a key: its
 * provider. There's no other choice to make. `notesInMeetings` is left out where it
 * doesn't apply (a meeting someone else hosts).
 */
export function AiNotesSettings({
  notesInMeetings,
}: {
  notesInMeetings?: boolean | undefined;
}) {
  const t = useTranslations("Settings.aiNotes");
  const sentence = useNotesSentence();
  const settings = useNotesSettings();
  const onDevice = useOnDeviceModel();
  const inEnglish = useOnDeviceNotesInEnglish();
  const keyInput = useRef<HTMLInputElement>(null);
  const { provider, model, key } = providerChoice(settings);
  const here = onDevice === null ? null : notesHere(settings, onDevice);

  return (
    <>
      <SectionTitle title={t("title")} intro={t("intro")} />
      {notesInMeetings === undefined ? null : (
        <NotesInMeetings allowed={notesInMeetings} />
      )}
      <SpeechCard />
      <SettingsCard title={t("keyTitle")}>
        <p
          aria-live="polite"
          className="max-w-[64ch] text-[15px] leading-normal font-semibold"
        >
          {here ? sentence.here(here) : null}
        </p>
        {here?.kind === "free" && inEnglish ? (
          <EnglishNotesNotice
            actions={[
              {
                label: t("useOwnKey"),
                onPress: () => keyInput.current?.focus(),
              },
            ]}
          />
        ) : null}
        {settings.keyRemoved ? (
          <div
            role="note"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-amber-100 px-3.5 py-2.5 text-sm text-amber-950 dark:bg-amber-400/15 dark:text-amber-100"
          >
            <p className="min-w-[min(100%,15rem)] flex-1 leading-normal">
              {t("keyRemoved")}
            </p>
            <UiButton
              variant="outline"
              size="sm"
              className="border-amber-950/30 bg-transparent hover:bg-amber-950/5 dark:border-amber-100/30 dark:hover:bg-amber-100/10"
              onPress={() => {
                // The note goes with its button: focus moves to the key first.
                keyInput.current?.focus();
                saveNotesSettings({ keyRemoved: undefined });
              }}
            >
              {t("gotIt")}
            </UiButton>
          </div>
        ) : null}
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
          <KeyField
            key={`${provider}:${model}`}
            provider={provider}
            model={model}
            value={key}
            inputRef={keyInput}
          />
          {/* Open from the start where a model was chosen, so it's never out of sight. */}
          <Disclosure
            defaultExpanded={Boolean(settings.models?.[provider])}
            className="group flex flex-col gap-3"
          >
            <Button
              slot="trigger"
              className="text-primary focus-visible:ring-ring flex items-center gap-1.5 self-start rounded-md text-sm font-semibold outline-none hover:underline focus-visible:ring-2"
            >
              <ChevronDown
                className="size-4 transition-transform group-data-expanded:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
              {t("moreOptions")}
            </Button>
            <DisclosurePanel>
              <ModelField key={provider} provider={provider} model={model} />
            </DisclosurePanel>
          </Disclosure>
        </div>
        <div className="text-muted-foreground flex max-w-[64ch] flex-col gap-2 text-[13px] leading-normal">
          <p className="flex items-start gap-2">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("keyStays", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
          </p>
          <p>{t("freeTiers")}</p>
        </div>
      </SettingsCard>
    </>
  );
}
