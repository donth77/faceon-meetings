import { describe, expect, it } from "vitest";

import { JoinRequest } from "./api";

describe("JoinRequest", () => {
  it("takes a guest's avatar seed", () => {
    expect(
      JoinRequest.parse({ name: "Ana", avatarSeed: "k3x9m2p7q1w8e4r6-f" }),
    ).toMatchObject({ avatarSeed: "k3x9m2p7q1w8e4r6-f" });
    expect(JoinRequest.parse({ name: "Ana" }).avatarSeed).toBeUndefined();
  });

  it("refuses anything that isn't a seed", () => {
    for (const avatarSeed of [
      "../../etc/passwd",
      "k3x9m2p7q1w8e4r6",
      "k3x9m2p7q1w8e4r6-x",
      "K3X9M2P7Q1W8E4R6-f",
      "k3x9m2p7q1w8e4r6-f.svg",
      "https://example.com/a.png",
      "",
    ]) {
      expect(JoinRequest.safeParse({ name: "Ana", avatarSeed }).success).toBe(
        false,
      );
    }
  });
});
