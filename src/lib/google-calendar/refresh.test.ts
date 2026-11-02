import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isRefusedGrant,
  refreshGoogleToken,
  watchGoogleRefresh,
} from "./refresh";

const refreshAccessToken = vi.hoisted(() => vi.fn());
vi.mock("better-auth/oauth2", () => ({ refreshAccessToken }));

/** Google's answer to a revoked or expired grant, as Better Auth's fetch reports it. */
const refused = {
  status: 400,
  statusText: "Bad Request",
  error: "invalid_grant",
  error_description: "Token has been expired or revoked.",
};

describe("refreshGoogleToken", () => {
  // A block, not an arrow returning the mock: Vitest would call a returned function
  // as the test's cleanup.
  beforeEach(() => {
    refreshAccessToken.mockReset();
  });

  it("refreshes at Google's token endpoint", async () => {
    refreshAccessToken.mockResolvedValue({ accessToken: "fresh" });
    await expect(refreshGoogleToken("refresh-token")).resolves.toEqual({
      accessToken: "fresh",
    });
    expect(refreshAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshToken: "refresh-token",
        tokenEndpoint: "https://oauth2.googleapis.com/token",
      }),
    );
  });

  it("tells a watching sync when Google refused the grant", async () => {
    refreshAccessToken.mockImplementation(async () => {
      throw refused;
    });
    const watch = { refused: false };
    const error = await watchGoogleRefresh(watch, () =>
      refreshGoogleToken("dead"),
    ).catch((thrown: unknown) => thrown);
    expect(error).toBe(refused);
    expect(watch.refused).toBe(true);
  });

  it("doesn't mistake an outage for a refused grant", async () => {
    const outage = new TypeError("fetch failed");
    refreshAccessToken.mockImplementation(async () => {
      throw outage;
    });
    const watch = { refused: false };
    const error = await watchGoogleRefresh(watch, () =>
      refreshGoogleToken("ok"),
    ).catch((thrown: unknown) => thrown);
    expect(error).toBe(outage);
    expect(watch.refused).toBe(false);
  });
});

describe("isRefusedGrant", () => {
  it("knows Google's refusal from anything else", () => {
    expect(isRefusedGrant(refused)).toBe(true);
    expect(isRefusedGrant({ error: "invalid_client" })).toBe(false);
    expect(isRefusedGrant(new Error("invalid_grant"))).toBe(false);
    expect(isRefusedGrant(null)).toBe(false);
  });
});
