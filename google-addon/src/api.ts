import type {
  AddonConference,
  AddonHome,
  AddonMeeting,
  ConferenceCreate,
  ConferenceUpdate,
  MeetingCreate,
} from "../../src/lib/addon/google/types";
import { errorOf, type AddonError } from "./api-errors";
import { FACEON_URL } from "./config";

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; error: AddonError };

type Method = GoogleAppsScript.URL_Fetch.HttpMethod;

/**
 * One call to FaceOn's API (/api/addon/google/*), carrying the person's Google identity
 * token, which is how FaceOn knows who's asking. The add-on keeps nothing itself.
 */
function call<T>(method: Method, path: string, body?: unknown): ApiResult<T> {
  let response: GoogleAppsScript.URL_Fetch.HTTPResponse;
  try {
    response = UrlFetchApp.fetch(`${FACEON_URL}/api/addon/google${path}`, {
      method,
      contentType: "application/json",
      muteHttpExceptions: true,
      headers: { Authorization: `Bearer ${ScriptApp.getIdentityToken()}` },
      ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
    });
  } catch {
    return { ok: false, error: { code: "TEMPORARY" } };
  }
  const status = response.getResponseCode();
  const text = response.getContentText();
  if (status >= 200 && status < 300) {
    return { ok: true, data: (text ? JSON.parse(text) : null) as T };
  }
  return { ok: false, error: errorOf(status, text) };
}

const codePath = (code: string) => `/conferences/${encodeURIComponent(code)}`;

export const api = {
  createConference: (input: ConferenceCreate) =>
    call<AddonConference>("post", "/conferences", input),
  updateConference: (code: string, input: ConferenceUpdate) =>
    call<null>("patch", codePath(code), input),
  cancelConference: (code: string) => call<null>("delete", codePath(code)),
  meeting: (input: MeetingCreate) =>
    call<AddonMeeting>("post", "/meetings", input),
  home: (locale: string | undefined, timeZone: string | undefined) => {
    const query = [
      locale ? `locale=${encodeURIComponent(locale)}` : "",
      timeZone ? `timeZone=${encodeURIComponent(timeZone)}` : "",
    ]
      .filter(Boolean)
      .join("&");
    return call<AddonHome>("get", `/home${query ? `?${query}` : ""}`);
  },
};
