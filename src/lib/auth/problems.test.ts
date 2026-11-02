import { describe, expect, it } from "vitest";

import { authProblem, linkProblem } from "./problems";

describe("authProblem", () => {
  it("says too many attempts for any rate-limited call", () => {
    expect(
      authProblem({ status: 429, code: "INVALID_EMAIL_OR_PASSWORD" }),
    ).toBe("tooMany");
  });

  it("maps Better Auth's codes", () => {
    expect(authProblem({ status: 403, code: "EMAIL_NOT_VERIFIED" })).toBe(
      "notVerified",
    );
    expect(authProblem({ status: 400, code: "PASSWORD_COMPROMISED" })).toBe(
      "passwordBreached",
    );
    expect(authProblem({ status: 400, code: "PASSWORD_TOO_SHORT" })).toBe(
      "passwordShort",
    );
    expect(authProblem({ status: 400, code: "INVALID_TOKEN" })).toBe(
      "invalidToken",
    );
  });

  it("treats an unexplained 401 as a wrong email or password", () => {
    expect(authProblem({ status: 401 })).toBe("wrongCredentials");
    expect(authProblem({ status: 500 })).toBe("generic");
  });
});

describe("linkProblem", () => {
  it("explains why connecting Google or GitHub failed", () => {
    expect(linkProblem("email_does_not_match")).toBe("emailMismatch");
    expect(linkProblem("email_doesn't_match")).toBe("emailMismatch");
    expect(linkProblem("account_already_linked_to_different_user")).toBe(
      "alreadyLinked",
    );
    expect(linkProblem("unable_to_link_account")).toBe("generic");
  });
});
