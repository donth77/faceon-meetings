import {
  ADDON_HEADERS,
  type AddonConference,
  type AddonHome,
  type AddonMeeting,
  type ConferenceCreate,
  type ConferenceUpdate,
  type MeetingCreate,
} from "../../src/lib/addon/google/types";
import { errorOf, type AddonError } from "./api-errors";
import { ADDON_VERSION, CONNECT_TOKEN, FACEON_URL } from "./config";

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; error: AddonError };

type Method = GoogleAppsScript.URL_Fetch.HttpMethod;

/**
 * One call to FaceOn's API (/api/addon/google/*), carrying the person's Google identity
 * token, which is how FaceOn knows who's asking, this copy's version, which FaceOn keeps
 * current, and the token that connects the copy to its owner (FaceOn needs it only the
 * first time). The add-on keeps nothing itself.
 */
function call<T>(method: Method, path: string, body?: unknown): ApiResult<T> {
  let response: GoogleAppsScript.URL_Fetch.HTTPResponse;
  try {
    response = UrlFetchApp.fetch(`${FACEON_URL}/api/addon/google${path}`, {
      method,
      contentType: "application/json",
      muteHttpExceptions: true,
      headers: {
        Authorization: `Bearer ${ScriptApp.getIdentityToken()}`,
        [ADDON_HEADERS.version]: ADDON_VERSION,
        ...(CONNECT_TOKEN ? { [ADDON_HEADERS.connect]: CONNECT_TOKEN } : {}),
      },
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
