"use client";

import { cn } from "cn";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type Ref } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { INPUT } from "@/components/ui/form-fields";
import {
  PASSCODE_MAX,
  passcodeProblem,
  randomPasscode,
} from "@/lib/meetings/codes";

/**
 * A meeting's passcode, as its host sets it: the generated one to start, their own if
 * they like, or Generate for a new random one. What's wrong with it shows once they've
 * left the field (or tried to save); capital letters don't matter to anyone joining.
 */
export function PasscodeField({
  value,
  onChange,
  showProblem = false,
  inputRef,
}: {
  value: string;
  onChange: (passcode: string) => void;
  /** Saving was tried: say what's wrong even before they leave the field. */
  showProblem?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const t = useTranslations("Passcode");
  const id = useId();
  const helpId = useId();
  const errorId = useId();
  const [left, setLeft] = useState(false);
  const problem = passcodeProblem(value);
  const shown = problem && (left || showProblem) ? problem : null;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {t("label")}
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={id}
          value={value}
          maxLength={PASSCODE_MAX + 4}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={shown ? true : undefined}
          aria-describedby={shown ? `${helpId} ${errorId}` : helpId}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setLeft(true)}
          className={cn(INPUT, "min-w-0 flex-1 font-mono tracking-wide")}
        />
        <Button
          variant="outline"
          className="h-[46px] shrink-0 rounded-[10px] px-3.5"
          aria-label={t("generateLabel")}
          onPress={() => onChange(randomPasscode())}
        >
          <RefreshCw aria-hidden="true" />
          {t("generate")}
        </Button>
      </div>
      <p id={helpId} className="text-muted-foreground text-[13px]">
        {t("rules")}
      </p>
      {shown ? (
        <p id={errorId} role="alert" className="text-destructive-text text-sm">
          {t(shown)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Change passcode, from a meeting's page or the personal room: the new one, then a word
 * on what it means before it's saved. The old passcode, and links with it, stop working;
 * anyone already in the meeting stays.
 */
export function ChangePasscodeDialog({
  current,
  onClose,
  onSave,
}: {
  current: string;
  onClose: () => void;
  /** Saves it; false when that failed (the dialog stays open to try again). */
  onSave: (passcode: string) => Promise<boolean>;
}) {
  const t = useTranslations("Passcode");
  const field = useRef<HTMLInputElement>(null);
  const [passcode, setPasscode] = useState(current);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setTried(true);
    if (passcodeProblem(passcode)) {
      field.current?.focus();
      return;
    }
    // Capital letters don't matter to anyone joining, so that isn't a change.
    if (passcode.trim().toUpperCase() === current.toUpperCase()) {
      onClose();
      return;
    }
    setSaving(true);
    const saved = await onSave(passcode.trim()).catch(() => false);
    setSaving(false);
    if (saved) onClose();
  }

  return (
    <ConfirmDialog
      isOpen
      onClose={onClose}
      title={t("changeTitle")}
      description={t("changeBody")}
      confirmLabel={t("changeConfirm")}
      cancelLabel={t("cancel")}
      isPending={saving}
      onConfirm={() => void save()}
    >
      <PasscodeField
        value={passcode}
        onChange={setPasscode}
        showProblem={tried}
        inputRef={field}
      />
    </ConfirmDialog>
  );
}
