/**
 * The Stream permissions FaceOn sets up (scripts/setup-stream.ts) and checks
 * (`checkPermissions`, daily and on Settings → Admin): what each role's browser may do in
 * a call. Free of imports, so the setup script can load it as it is.
 */

/**
 * Grant names (not capability names): reactions are "create-call-reaction", and chat and
 * other custom events need "send-event".
 */
export const MEMBER_GRANTS = [
  "read-call",
  "join-call",
  "send-audio",
  "send-video",
  "screenshare",
  "create-call-reaction",
  "send-event",
];

/**
 * Hosts and co-hosts moderate through FaceOn's API, which checks who may do what (a
 * co-host can't remove the host, say) and acts with the server's credentials. Their
 * browsers get no more than everyone's, so Stream's SDK can't go around those rules.
 */
const OUTSIDERS: Record<string, string[]> = {
  user: [],
  guest: [],
  anonymous: [],
};

/** Stream's own call types, locked: a call token adds access rather than confining it. */
export const BUILT_IN_CALL_TYPES = [
  "default",
  "audio_room",
  "livestream",
  "development",
];

/** Each call type's roles and their grants, as FaceOn sets them up. */
export const EXPECTED_GRANTS: Record<string, Record<string, string[]>> = {
  meeting: {
    ...OUTSIDERS,
    call_member: MEMBER_GRANTS,
    cohost: MEMBER_GRANTS,
    host: MEMBER_GRANTS,
  },
  ...Object.fromEntries(BUILT_IN_CALL_TYPES.map((name) => [name, OUTSIDERS])),
};

/** How a call type differs from what FaceOn sets up. */
export type GrantsDrift = {
  callType: string;
  /** Not on Stream at all. */
  missing: boolean;
  /** The roles whose grants differ. */
  roles: string[];
};

const sorted = (list: readonly string[] | undefined) =>
  [...(list ?? [])].sort().join(",");

/**
 * Every call type that differs from EXPECTED_GRANTS, given Stream's own (listCallTypes),
 * in EXPECTED_GRANTS' order. Empty when everything matches.
 */
export function grantsDrift(
  live: Record<
    string,
    { grants?: Record<string, readonly string[]> | undefined } | undefined
  >,
): GrantsDrift[] {
  return Object.entries(EXPECTED_GRANTS).flatMap(([callType, grants]) => {
    const current = live[callType];
    const roles = Object.keys(grants).filter(
      (role) => sorted(current?.grants?.[role]) !== sorted(grants[role]),
    );
    return !current || roles.length > 0
      ? [{ callType, missing: !current, roles }]
      : [];
  });
}
