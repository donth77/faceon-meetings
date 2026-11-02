"use client";

import { cn } from "cn";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  type Key,
} from "react-aria-components";

import { Switch } from "@/components/ui/switch";

/**
 * The app's form kit: the text input look, labelled fields, radio dots, selects and
 * switch rows, shared by scheduling, Settings and the meeting's settings.
 */

/** A text input, or a button that opens a picker, the height of the form's fields. */
export const INPUT =
  "bg-background border-input focus-visible:focus-ring h-[46px] w-full rounded-[10px] border px-3 text-base outline-hidden";

/** The popover under a field (selects, time zones, dates). */
export const FIELD_POPOVER =
  "bg-popover text-popover-foreground rounded-xl p-1.5 shadow-[0_16px_40px_rgba(18,22,28,0.18)] ring-1 ring-black/10 outline-hidden dark:ring-white/10";

/** An option in a field's list. */
export const FIELD_OPTION =
  "data-focused:bg-accent data-focus-visible:focus-ring-inset flex min-h-10 items-center gap-2 rounded-lg px-2 text-[15px] outline-hidden";

/** A label above a control, with "(optional)" and a helper line when given. */
export function Field({
  label,
  optional,
  htmlFor,
  labelId,
  className,
  children,
}: {
  label: string;
  /** The "(optional)" suffix, translated. */
  optional?: string;
  htmlFor?: string;
  labelId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label id={labelId} htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
        {optional ? (
          <span className="text-muted-foreground font-normal"> {optional}</span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

/**
 * The dot of a radio choice; put it inside a React Aria Radio with the group class. It
 * shows keyboard focus, unless the choice is a card that shows it (`showFocus={false}`).
 */
export function RadioDot({
  className,
  showFocus = true,
}: {
  className?: string;
  showFocus?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "border-input group-data-selected:border-primary flex size-[18px] shrink-0 items-center justify-center rounded-full border-2",
        showFocus && "group-data-focus-visible:focus-ring",
        className,
      )}
    >
      <span className="bg-primary hidden size-2 rounded-full group-data-selected:block" />
    </span>
  );
}

export type Option = {
  id: string;
  label: string;
  /** A line above it, for an option that does something different (Custom…). */
  separated?: boolean;
};

/** A select that looks like the form's inputs, with a check beside the chosen option. */
export function SelectField({
  label,
  hideLabel,
  options,
  value,
  isDisabled,
  onChange,
  icon: Icon,
  className,
  buttonClassName,
  popoverClassName,
}: {
  label: string;
  /** The label is for screen readers only; something nearby says what it is. */
  hideLabel?: boolean;
  options: Option[];
  value: string;
  isDisabled?: boolean;
  onChange: (value: string) => void;
  icon?: LucideIcon;
  className?: string;
  buttonClassName?: string;
  popoverClassName?: string;
}) {
  return (
    <Select
      selectedKey={value}
      isDisabled={isDisabled}
      onSelectionChange={(key: Key | null) => {
        if (key !== null) onChange(String(key));
      }}
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
    >
      {({ isOpen, isDisabled: disabled }) => (
        <>
          <Label
            className={cn(
              hideLabel ? "sr-only" : "text-sm font-semibold",
              disabled && "text-muted-foreground",
            )}
          >
            {label}
          </Label>
          <Button
            className={cn(
              INPUT,
              "flex items-center gap-2 text-left data-disabled:cursor-not-allowed data-disabled:opacity-50",
              isOpen && "border-ring",
              buttonClassName,
            )}
          >
            {Icon ? (
              <Icon
                className="text-muted-foreground size-[18px] shrink-0"
                aria-hidden="true"
              />
            ) : null}
            <SelectValue className="min-w-0 flex-1 truncate" />
            <ChevronDown
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden="true"
            />
          </Button>
          <Popover
            placement="bottom start"
            className={cn(
              FIELD_POPOVER,
              "max-h-80 min-w-(--trigger-width) overflow-auto",
              popoverClassName,
            )}
          >
            <ListBox items={options} className="outline-hidden">
              {(option) => (
                <ListBoxItem
                  id={option.id}
                  textValue={option.label}
                  className={cn(
                    FIELD_OPTION,
                    option.separated && "mt-1 rounded-t-none border-t",
                  )}
                >
                  {({ isSelected }) => (
                    <>
                      <span className="text-primary flex w-[18px] justify-center">
                        {isSelected ? (
                          <Check className="size-4" aria-hidden="true" />
                        ) : null}
                      </span>
                      {option.label}
                    </>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </>
      )}
    </Select>
  );
}

/** A setting with a label and helper on the left and a switch on the right. */
export function SwitchRow({
  label,
  help,
  isSelected,
  isDisabled,
  onChange,
}: {
  label: string;
  help?: ReactNode;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const helpId = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div
        className={cn(
          "flex min-w-0 flex-col gap-0.5",
          isDisabled && "text-muted-foreground",
        )}
      >
        <span className="text-[15px] font-semibold">{label}</span>
        {help ? (
          <span id={helpId} className="text-muted-foreground text-[13px]">
            {help}
          </span>
        ) : null}
      </div>
      <Switch
        isSelected={isSelected}
        isDisabled={isDisabled}
        onChange={onChange}
        aria-label={label}
        aria-describedby={help ? helpId : undefined}
      />
    </div>
  );
}
