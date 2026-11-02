import {
  MEETING_ERRORS,
  type HandRequest,
  type JoinRequest,
  type JoinResponse,
  type MeetingErrorCode,
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

async function post<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
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

/** The meeting client's calls to our meeting API. */
export const meetingApi = {
  join: (code: string, request: JoinRequest) =>
    post<JoinResponse>(`/api/meetings/${code}/join`, request),
  token: async (code: string, room: string) =>
    (await post<TokenResponse>(`/api/meetings/${code}/token`, { room })).token,
  end: (code: string) => post<void>(`/api/meetings/${code}/end`),
  hand: (code: string, request: HandRequest) =>
    post<void>(`/api/meetings/${code}/hand`, request),
};
