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
        {sections.map((section) => (
          <DropdownMenuGroup
            key={section.title}
            aria-label={section.title}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={section.selectedId ? [section.selectedId] : []}
            onSelectionChange={(keys) => {
              const deviceId = firstKey(keys);
              if (typeof deviceId === "string") section.onSelect(deviceId);
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
                    id={device.deviceId}
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
