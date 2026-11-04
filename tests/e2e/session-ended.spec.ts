import { database } from "./support/db";
import { expect, expectNoErrors, test } from "./support/fixtures";

test.describe("a sign-in that has ended", () => {
  test("goes to sign-in once, without its cookie, rather than back and forth", async ({
    people,
  }) => {
    // Signed out on another device, say: the cookie is still here, its session isn't.
    const away = await people.signedIn();
    await database().query(`delete from session where user_id = $1`, [
      away.user.id,
    ]);
    const visited: string[] = [];
    away.page.on("framenavigated", (frame) => {
      if (frame === away.page.mainFrame()) visited.push(frame.url());
    });
    await away.page.goto("/home");
    await expect(
      away.page.getByRole("heading", { level: 1, name: /^Sign in/ }),
    ).toBeVisible();
    await expect(away.page).toHaveURL(/\/sign-in\?next=%2Fhome$/);
    // The cookie is gone, or left empty, which counts as signed out.
    const cookies = await away.context.cookies();
    expect(
      cookies.filter(
        (cookie) =>
          cookie.name === "better-auth.session_token" && cookie.value !== "",
      ),
    ).toEqual([]);
    // Still there a moment later: nothing sends it on again. (Only time can show that.)
    await away.page.waitForTimeout(2_000);
    await expect(away.page).toHaveURL(/\/sign-in\?next=%2Fhome$/);
    expect(visited.length).toBeLessThan(5);

    // A sign-in that's still good passes straight through, and stays signed in.
    const here = await people.signedIn();
    await here.page.goto("/api/session/ended?next=%2Fsettings%2Fai-notes");
    await expect(here.page).toHaveURL(/\/settings\/ai-notes$/);
    await expect(
      here.page.getByRole("heading", { level: 2, name: "AI notes" }),
    ).toBeVisible();
    expectNoErrors(away, here);
  });
});
