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

export const INPUT =
  "bg-background focus-visible:ring-ring h-[46px] w-full rounded-[10px] border border-[#c9cfd8] px-3 text-base outline-none focus-visible:ring-2 dark:border-white/15";

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

/** The dot of a radio choice; put it inside a React Aria Radio with the group class. */
export function RadioDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "group-data-focus-visible:ring-ring flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 border-[#c9cfd8] group-data-focus-visible:ring-2 group-data-selected:border-[#1f5eff] dark:border-white/30",
        className,
      )}
    >
      <span className="hidden size-2 rounded-full bg-[#1f5eff] group-data-selected:block" />
    </span>
  );
}

export type Option = { id: string; label: string };

/** A select that looks like the form's inputs, with a check beside the chosen option. */
export function SelectField({
  label,
  options,
  value,
  onChange,
  icon: Icon,
  className,
  buttonClassName,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  icon?: LucideIcon;
  className?: string;
  buttonClassName?: string;
}) {
  return (
    <Select
      selectedKey={value}
      onSelectionChange={(key: Key | null) => {
        if (key !== null) onChange(String(key));
      }}
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
    >
      {({ isOpen }) => (
        <>
          <Label className="text-sm font-semibold">{label}</Label>
          <Button
            className={cn(
              INPUT,
              "flex items-center gap-2 text-left",
              isOpen && "ring-ring ring-2",
              buttonClassName,
            )}
          >
            {Icon ? (
              <Icon className="text-muted-foreground size-[18px] shrink-0" />
            ) : null}
            <SelectValue className="min-w-0 flex-1 truncate" />
            <ChevronDown
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden="true"
            />
          </Button>
          <Popover
            placement="bottom start"
            className="bg-popover text-popover-foreground max-h-80 min-w-(--trigger-width) overflow-auto rounded-xl p-1.5 shadow-[0_16px_40px_rgba(18,22,28,0.18)] ring-1 ring-black/10 outline-none dark:ring-white/10"
          >
            <ListBox items={options} className="outline-none">
              {(option) => (
                <ListBoxItem
                  id={option.id}
                  textValue={option.label}
                  className="data-focused:bg-accent data-focus-visible:focus-ring-inset flex min-h-10 cursor-default items-center gap-2 rounded-lg px-2 text-[15px] outline-hidden"
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
