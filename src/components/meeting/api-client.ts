import {
  MEETING_ERRORS,
  type AdmissionResponse,
  type HandRequest,
  type JoinRequest,
  type JoinResponse,
  type LobbyAction,
  type LobbyResponse,
  type MeetingErrorCode,
  type ModerateRequest,
  type TokenResponse,
} from "@/lib/meetings/api";

/** A failed meeting API call: the server's error code, or NETWORK when it couldn't be reached. */
export class MeetingRequestError extends Error {
  constructor(readonly code: MeetingErrorCode | "NETWORK") {
    super(code);
    this.name = "MeetingRequestError";
  }
}

const isErrorCode = (value: unknown): value is MeetingErrorCode =>
  typeof value === "string" && Object.hasOwn(MEETING_ERRORS, value);

function errorCodeOf(body: unknown): MeetingErrorCode | undefined {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return undefined;
  }
  const { error } = body as { error: unknown };
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code: unknown }).code
      : undefined;
  return isErrorCode(code) ? code : undefined;
}

async function send<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      ...init,
    });
  } catch {
    throw new MeetingRequestError("NETWORK");
  }
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new MeetingRequestError(errorCodeOf(data) ?? "UNAVAILABLE");
  }
  return data as T;
}

const post = <T>(path: string, body?: unknown) => send<T>("POST", path, body);

/** The meeting client's calls to our meeting API. */
export const meetingApi = {
  join: (code: string, request: JoinRequest) =>
    post<JoinResponse>(`/api/meetings/${code}/join`, request),
  token: async (code: string, room: string) =>
    (await post<TokenResponse>(`/api/meetings/${code}/token`, { room })).token,
  end: (code: string) => post<void>(`/api/meetings/${code}/end`),
  hand: (code: string, request: HandRequest) =>
    post<void>(`/api/meetings/${code}/hand`, request),
  moderate: (code: string, request: ModerateRequest) =>
    post<void>(`/api/meetings/${code}/moderate`, request),
  pollAdmission: (code: string, requestId: string) =>
    post<AdmissionResponse>(`/api/meetings/${code}/admission/${requestId}`),
  /** keepalive lets the request finish while the tab closes. */
  cancelAdmission: (code: string, requestId: string, keepalive = false) =>
    send<void>(
      "DELETE",
      `/api/meetings/${code}/admission/${requestId}`,
      undefined,
      { keepalive },
    ),
  lobby: (code: string) =>
    send<LobbyResponse>("GET", `/api/meetings/${code}/lobby`),
  decide: (code: string, action: LobbyAction) =>
    post<void>(`/api/meetings/${code}/lobby`, action),
};
