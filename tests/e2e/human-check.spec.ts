import {
  expect,
  expectNoErrors,
  needsHumanCheck,
  test,
} from "./support/fixtures";
import { fakeHumanCheck } from "./support/human-check";

const CONFIRM = "Confirm you’re a person to continue.";
const FAILED = "The check that keeps out bots didn’t load.";
/** No account has this address, so nothing is sent. */
const EMAIL = "nobody@example.com";
const SENT = `If an account exists for ${EMAIL}`;

test.describe("the check for a person", () => {
  test.beforeEach(() => needsHumanCheck());

  test("Send link waits as long as the person takes to answer it", async ({
    people,
  }) => {
    const visitor = await people.guest();
    const { page } = visitor;
    await page.clock.install();
    await fakeHumanCheck(page, ["ask", "pass"]);
    await page.goto("/forgot-password");
    await expect(page.getByText(CONFIRM)).toBeVisible();

    await page.getByLabel("Email").fill(EMAIL);
    await page.getByRole("button", { name: "Send link" }).click();
    // Longer than Send waits for Cloudflare itself.
    await page.clock.fastForward("01:00");
    await expect(page.getByText(CONFIRM)).toBeVisible();
    await expect(page.getByText(FAILED)).toBeHidden();

    const request = page.waitForRequest("**/api/auth/request-password-reset");
    await page.getByRole("checkbox", { name: "Verify you are human" }).click();
    expect((await request).headers()["x-captcha-response"]).toMatch(
      /^fake-token-/,
    );
    await expect(page.getByText(SENT)).toBeVisible();
    await expect(page.getByText(CONFIRM)).toBeHidden();
    expectNoErrors(visitor);
  });

  test("says when it couldn't run, and Try again starts it over", async ({
    people,
  }) => {
    const visitor = await people.guest();
    const { page } = visitor;
    await fakeHumanCheck(page, ["fail", "pass"]);
    await page.goto("/forgot-password");
    await expect(page.getByText(FAILED)).toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText(FAILED)).toBeHidden();
    await page.getByLabel("Email").fill(EMAIL);
    const request = page.waitForRequest("**/api/auth/request-password-reset");
    await page.getByRole("button", { name: "Send link" }).click();
    expect((await request).headers()["x-captcha-response"]).toMatch(
      /^fake-token-/,
    );
    await expect(page.getByText(SENT)).toBeVisible();
    expectNoErrors(visitor);
  });
});
