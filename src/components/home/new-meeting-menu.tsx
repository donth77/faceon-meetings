"use client";

import { CalendarPlus, Link2, Plus, Video } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Meet-style "New meeting" menu. The meeting actions arrive with the meeting core,
 * so they're shown but disabled for now.
 */
export function NewMeetingMenu() {
  const t = useTranslations("Home");

  return (
    <DropdownMenuTrigger>
      <Button size="lg" className="gap-2">
        <Plus aria-hidden="true" />
        {t("newMeeting")}
      </Button>
      <DropdownMenu
        placement="bottom start"
        className="min-w-64"
        disabledKeys={["instant", "later", "schedule"]}
      >
        <DropdownMenuItem id="instant" textValue={t("startInstant")}>
          <Video aria-hidden="true" />
          {t("startInstant")}
        </DropdownMenuItem>
        <DropdownMenuItem id="later" textValue={t("createForLater")}>
          <Link2 aria-hidden="true" />
          {t("createForLater")}
        </DropdownMenuItem>
        <DropdownMenuItem id="schedule" textValue={t("schedule")}>
          <CalendarPlus aria-hidden="true" />
          {t("schedule")}
        </DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}
