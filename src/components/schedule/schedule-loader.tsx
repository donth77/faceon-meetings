"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import { PanelLoading } from "@/components/app-shell/loading";

import type { ScheduleForm } from "./schedule-form";

/**
 * The schedule form runs in the browser only: its defaults (the next half hour, this
 * device's time zone) come from this device, so nothing would match a server render.
 */
const Form = dynamic(
  () => import("./schedule-form").then((module) => module.ScheduleForm),
  {
    ssr: false,
    loading: () => <PanelLoading height="h-[560px]" />,
  },
);

export function ScheduleFormLoader(props: ComponentProps<typeof ScheduleForm>) {
  return <Form {...props} />;
}
