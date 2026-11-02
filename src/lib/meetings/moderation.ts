import "server-only";

import { mediaProvider } from "@/lib/media";
import type { MediaProvider, PublishPermissions } from "@/lib/media/types";

import { requireMeeting, requireMember, requirePrincipal } from "./access";
import type { ModerateRequest } from "./api";
import { MeetingError } from "./errors";
import type { SessionPolicy } from "./policy";
import type { Principal } from "./principal";
import {
  banMember,
  findMember,
  hostMemberIds,
  sessionMembers,
  setMemberRole,
  type MeetingSession,
} from "./queries";
import { canModerate, isHostRole } from "./rules";
import {
  changeSession,
  changeSessionFrom,
  sessionPolicy,
} from "./session-state";
import { admitEveryone } from "./waiting-room";

/** After a policy change, gives every participant's publishing rights back or takes them. */
async function applyPolicy(
  provider: MediaProvider,
  session: MeetingSession,
  before: SessionPolicy,
  after: SessionPolicy,
): Promise<void> {
  const changes: PublishPermissions = {
    ...(before.selfUnmute !== after.selfUnmute
      ? { audio: after.selfUnmute }
      : {}),
    ...(before.screenShare !== after.screenShare
      ? { screen: after.screenShare === "all" }
      : {}),
  };
  if (Object.keys(changes).length === 0) return;
  const participants = (await sessionMembers(session.id)).filter(
    (member) => !isHostRole(member.role),
  );
  await Promise.all(
    participants.map((member) =>
      provider.setPublishPermissions(session.id, member.mediaUserId, changes),
    ),
  );
}

/**
 * Host controls: mute, ask to unmute, spotlight, remove, co-hosts and the session's
 * policies. The caller must be a host or co-host of the open session (checked against
 * our records, not the client), and the permission matrix decides the rest.
 */
export async function moderate(input: {
  code: string;
  principal: Principal | null;
  request: ModerateRequest;
}): Promise<void> {
  const { meeting } = await requireMeeting(input.code);
  const principal = requirePrincipal(input.principal);
  const { session, member: actor } = await requireMember(meeting.id, principal);
  const { request } = input;

  const targetId = "target" in request ? request.target : null;
  const target = targetId ? await findMember(session.id, targetId) : null;
  if (targetId && (!target || target.bannedAt)) {
    throw new MeetingError("BAD_REQUEST");
  }
  const allowed = canModerate({
    actor: actor.role,
    action: request.action,
    target: target && {
      role: target.role,
      isSelf: target.mediaUserId === actor.mediaUserId,
    },
  });
  if (!allowed) throw new MeetingError("NOT_ALLOWED");

  const provider = mediaProvider(session.provider);
  const policy = sessionPolicy(meeting, session);
  // Everything below needs a target except the actions on everyone.
  const subject = target?.mediaUserId ?? "";
  const subjectIsParticipant = target !== null && !isHostRole(target.role);

  switch (request.action) {
    case "mute": {
      const kinds =
        request.kind === "screenshare"
          ? (["screenshare", "screenshare_audio"] as const)
          : ([request.kind] as const);
      await provider.mute(session.id, [subject], [...kinds]);
      // Without self-unmute, a muted participant needs a host's OK to speak again.
      if (
        request.kind === "audio" &&
        !policy.selfUnmute &&
        subjectIsParticipant
      ) {
        await provider.setPublishPermissions(session.id, subject, {
          audio: false,
        });
      }
      return;
    }

    case "muteAll": {
      const [snapshot, hosts] = await Promise.all([
        provider.inspectSession(session.id),
        hostMemberIds(session.id),
      ]);
      const everyoneElse = (snapshot?.connectedUserIds ?? []).filter(
        (id) => !hosts.includes(id),
      );
      await provider.mute(session.id, everyoneElse, ["audio"]);
      if (request.selfUnmute !== policy.selfUnmute) {
        const { before, after } = await changeSessionFrom(meeting, session, {
          policy: { selfUnmute: request.selfUnmute },
        });
        await applyPolicy(provider, session, before, after);
      }
      return;
    }

    case "askToUnmute":
      if (!policy.selfUnmute && subjectIsParticipant) {
        await provider.setPublishPermissions(session.id, subject, {
          audio: true,
        });
      }
      await provider.sendServerEvent(session.id, {
        type: "host.request_unmute",
        target: subject,
      });
      return;

    case "spotlight":
      await changeSession(meeting, session, {
        spotlight: target?.mediaUserId ?? null,
      });
      return;

    case "remove":
      // Banned first, so a rejoin racing the removal is refused.
      await banMember(session.id, subject);
      await provider.remove(session.id, subject, { block: true });
      await changeSession(meeting, session, { forget: subject });
      return;

    case "makeCohost":
      await setMemberRole(session.id, subject, "cohost");
      await provider.setRole(session.id, subject, "cohost");
      await provider.setPublishPermissions(session.id, subject, {
        audio: true,
        video: true,
        screen: true,
      });
      await changeSession(meeting, session, { roles: true });
      return;

    case "removeCohost": {
      const role = target?.userId ? "participant" : "guest";
      await setMemberRole(session.id, subject, role);
      await provider.setRole(session.id, subject, role);
      // Their mic stays as it is; screen sharing follows the policy again.
      if (policy.screenShare === "host") {
        await provider.setPublishPermissions(session.id, subject, {
          screen: false,
        });
      }
      await changeSession(meeting, session, { roles: true });
      return;
    }

    case "setPolicy": {
      // Compared with the policy as it was under the lock, not as read above: two hosts
      // changing it at once each apply only what their change did.
      const { before, after } = await changeSessionFrom(meeting, session, {
        policy: request.policy,
      });
      await applyPolicy(provider, session, before, after);
      // Turning the waiting room off lets everyone waiting in, as in Zoom.
      if (before.waitingRoom && !after.waitingRoom) {
        await admitEveryone(session);
      }
      return;
    }
  }
}
