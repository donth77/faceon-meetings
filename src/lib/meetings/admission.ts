import "server-only";

import { mediaProvider } from "@/lib/media";
import type { MeetingRole } from "@/lib/media/types";
import { serverEnv } from "@/lib/server-env";

import type { Admitted } from "./api";
import { withheldFrom } from "./policy";
import type { Principal } from "./principal";
import {
  upsertMember,
  type Meeting,
  type MeetingHost,
  type MeetingSession,
} from "./queries";
import { isHostRole } from "./rules";
import { sessionPolicy } from "./session-state";
import { secondsLeft } from "./sessions";

/**
 * Lets someone into an open session: records them as a member, adds them to the call
 * with what the hosts' policies allow, and returns what their browser needs to connect.
 * Nobody gets a media token any other way.
 */
export async function admit(input: {
  meeting: Meeting;
  host: MeetingHost;
  session: MeetingSession;
  principal: Principal;
  name: string;
  role: MeetingRole;
  now: Date;
}): Promise<Admitted> {
  const { meeting, host, session, principal, role } = input;
  const provider = mediaProvider(session.provider);
  const self = {
    id: principal.mediaUserId,
    name: input.name,
    image: principal.image,
    role,
  };
  await upsertMember({
    sessionId: session.id,
    mediaUserId: self.id,
    userId: principal.kind === "user" ? principal.userId : null,
    displayName: self.name,
    image: self.image ?? null,
    role,
  });
  const connection = await provider.admit({
    sessionId: session.id,
    user: self,
    role,
  });
  // Before they connect: what the hosts' policies withhold from participants.
  const withheld = isHostRole(role)
    ? null
    : withheldFrom(sessionPolicy(meeting, session));
  if (withheld) {
    await provider.setPublishPermissions(session.id, self.id, withheld);
  }

  return {
    state: "admitted",
    connection,
    self,
    meeting: {
      code: meeting.code,
      title: meeting.title,
      passcode: meeting.passcode,
      hostName: host.name,
      muteOnEntry: meeting.settings.muteOnEntry,
      videoOffOnEntry: meeting.settings.videoOffOnEntry,
    },
    session: {
      demo: session.limits.demo === true,
      maxParticipants: session.limits.maxParticipants,
      maxMinutes: session.limits.maxDurationSeconds
        ? Math.round(session.limits.maxDurationSeconds / 60)
        : null,
      secondsLeft: secondsLeft(session, input.now),
      aloneTimeoutMinutes: serverEnv().ALONE_TIMEOUT_MINUTES || null,
    },
  };
}
