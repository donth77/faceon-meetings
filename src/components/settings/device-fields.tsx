"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { SelectField } from "@/components/ui/form-fields";
import {
  loadDevicePreferences,
  saveDevicePreferences,
  type DevicePreferences,
} from "@/lib/device/preferences";

/**
 * The camera, microphone and speaker remembered on this device: the ones the next
 * meeting starts with. Choosing one here is the same as choosing it before joining.
 */
export function useRememberedDevices() {
  const [devices, setDevices] = useState(loadDevicePreferences);
  useEffect(() => saveDevicePreferences(devices), [devices]);
  const update = (patch: Partial<DevicePreferences>) =>
    setDevices((current) => ({ ...current, ...patch }));
  return [devices, update] as const;
}

/** A device picker; with nothing to list yet (before permission), it says so. */
export function DeviceField({
  label,
  devices,
  value,
  activeId,
  onChange,
}: {
  label: string;
  devices: MediaDeviceInfo[];
  /** The remembered choice. */
  value: string | undefined;
  /** The device actually in use, when the remembered one is missing. */
  activeId?: string | undefined;
  onChange: (deviceId: string) => void;
}) {
  const t = useTranslations("Meeting");
  const options = devices.map((device, index) => ({
    id: device.deviceId,
    label: device.label || t("deviceNumber", { n: index + 1 }),
  }));
  const known = (id: string | undefined) =>
    id !== undefined && options.some((option) => option.id === id);
  const selected = known(value)
    ? value
    : known(activeId)
      ? activeId
      : options[0]?.id;
  return (
    <SelectField
      label={label}
      options={options.length ? options : [{ id: "", label: t("noDevices") }]}
      value={selected ?? ""}
      onChange={(id) => {
        if (id) onChange(id);
      }}
    />
  );
}
