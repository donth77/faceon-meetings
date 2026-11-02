"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import type { ScheduleForm } from "./schedule-form";

/**
 * The schedule form runs in the browser only: its defaults (the next half hour, this
 * device's time zone) come from this device, so nothing would match a server render.
 */
const Form = dynamic(
  () => import("./schedule-form").then((module) => module.ScheduleForm),
  {
    ssr: false,
    loading: () => <div className="min-h-[600px]" aria-busy="true" />,
  },
);

export function ScheduleFormLoader(props: ComponentProps<typeof ScheduleForm>) {
  return <Form {...props} />;
}
