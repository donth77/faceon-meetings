import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PersonalRoomView } from "@/components/personal-room/personal-room-view";
import { requireSession } from "@/lib/auth/session";
import { getOrCreatePersonalRoom } from "@/lib/meetings/queries";
import { PERSONAL_ROOM_ROUTE } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PersonalRoom");
  return { title: t("title") };
}

export default function PersonalRoomPage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <PersonalRoom />
    </Suspense>
  );
}

/** The signed-in user's personal room, created the first time they open this page. */
async function PersonalRoom() {
  const session = await requireSession(PERSONAL_ROOM_ROUTE);
  const room = await getOrCreatePersonalRoom(session.user.id);
  return (
    <PersonalRoomView
      room={{
        code: room.code,
        passcode: room.passcode,
        title: room.title,
        hostName: session.user.name,
        settings: {
          waitingRoom: room.settings.waitingRoom,
          allowGuests: room.settings.allowGuests,
          muteOnEntry: room.settings.muteOnEntry,
        },
      }}
    />
  );
}
