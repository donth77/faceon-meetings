"use client";

import { ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, type Selection } from "react-aria-components";

import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type DeviceSection = {
  title: string;
  devices: MediaDeviceInfo[];
  selectedId: string | undefined;
  onSelect: (deviceId: string) => void;
};

const firstKey = (keys: Selection) =>
  keys === "all" ? undefined : [...keys][0];

/**
 * Item keys are per section: browsers give a microphone and a speaker the same IDs
 * ("default", "communications" on Windows), and one menu can't hold the same key twice.
 */
const itemKey = (section: number, deviceId: string) => `${section}:${deviceId}`;
const deviceIdOf = (key: string) => key.slice(key.indexOf(":") + 1);

/** The caret beside the mic and camera buttons: pick a microphone, speaker or camera. */
export function DeviceMenu({
  label,
  sections,
}: {
  label: string;
  sections: DeviceSection[];
}) {
  const t = useTranslations("Meeting");

  return (
    <DropdownMenuTrigger>
      <Button
        aria-label={label}
        className="border-background focus-visible:ring-ring data-[pressed]:bg-accent absolute top-[26px] right-3 flex size-[22px] items-center justify-center rounded-full border-2 bg-[#3a424d] text-[#e6eaee] outline-none hover:bg-[#4a5260] focus-visible:ring-2 max-md:hidden"
      >
        <ChevronUp className="size-3" aria-hidden="true" />
      </Button>
      <DropdownMenu placement="top" className="max-w-sm min-w-72">
        {sections.map((section, sectionIndex) => (
          <DropdownMenuGroup
            key={section.title}
            aria-label={section.title}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={
              section.selectedId
                ? [itemKey(sectionIndex, section.selectedId)]
                : []
            }
            onSelectionChange={(keys) => {
              const key = firstKey(keys);
              if (typeof key === "string") section.onSelect(deviceIdOf(key));
            }}
          >
            <DropdownMenuLabel>{section.title}</DropdownMenuLabel>
            {section.devices.length === 0 ? (
              <DropdownMenuItem id={`${section.title}-none`} isDisabled>
                {t("noDevices")}
              </DropdownMenuItem>
            ) : (
              section.devices.map((device, index) => {
                const name =
                  device.label || t("deviceNumber", { n: index + 1 });
                return (
                  <DropdownMenuItem
                    key={device.deviceId}
                    id={itemKey(sectionIndex, device.deviceId)}
                    textValue={name}
                  >
                    <span className="truncate">{name}</span>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuGroup>
        ))}
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}
