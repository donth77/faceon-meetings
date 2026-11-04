import { database } from "./support/db";
import { HOSTS_ADMIN_EMAIL } from "./support/env";
import { expect, expectNoErrors, hydrated, test } from "./support/fixtures";

/** Addresses these tests approve, so a failed run doesn't leave them on the list. */
const INVITEE = /^e2e_invite_/;

test.afterEach(async () => {
  await database().query(
    `delete from host_allowlist where email like 'e2e\\_invite\\_%'`,
  );
});

test.describe("Settings → Admin → inviting approved hosts", () => {
  // Both sign in as the same second test admin, so one at a time.
  test.describe.configure({ mode: "serial" });

  test("an admin approves an address and copies its invite link; once its owner signs up, the list says Joined and they host full meetings", async ({
    people,
  }) => {
    const admin = await people.signedIn({
      email: HOSTS_ADMIN_EMAIL,
      name: "Hana Admin",
    });
    const { page, context } = admin;
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const invitee = `e2e_invite_${Date.now().toString(36)}@faceon.test`;
    expect(invitee).toMatch(INVITEE);

    await page.goto("/settings/admin");
    await hydrated(page.getByLabel("Email address"));
    await page.getByLabel("Email address").fill(invitee);
    // Emailing an invitation is only ever a choice, and this build has no email set up,
    // so it isn't offered at all: adding sends nothing.
    await expect(page.getByLabel("Email them an invitation")).toHaveCount(0);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      page.getByText(`${invitee} can now host full meetings.`),
    ).toBeVisible();

    const row = page.getByRole("listitem").filter({ hasText: invitee });
    await expect(row.getByText("Approved", { exact: true })).toBeVisible();
    await expect(
      row.getByRole("button", { name: `Send an invitation to ${invitee}` }),
    ).toHaveCount(0);

    // The invite link: sign-up with the address filled in, for the admin to send.
    await row
      .getByRole("button", { name: `Copy an invite link for ${invitee}` })
      .click();
    await expect(page.getByText(/Invite link copied/)).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(
      new RegExp(`/sign-up\\?email=${encodeURIComponent(invitee)}$`),
    );

    const visitor = await people.guest();
    const opened = new URL(link);
    await visitor.page.goto(`${opened.pathname}${opened.search}`);
    await expect(
      visitor.page.getByRole("heading", {
        level: 1,
        name: /Create your .* account/,
      }),
    ).toBeVisible();

    // They sign up and verify that address: the list says Joined, nothing is left to
    // invite them to, and their meetings are full ones.
    const host = await people.signedIn({ email: invitee, name: "Ivy Invitee" });
    await page.reload();
    await expect(row.getByText("Joined", { exact: true })).toBeVisible();
    await expect(
      row.getByRole("button", { name: /Copy an invite link/ }),
    ).toHaveCount(0);
    await host.page.goto("/home");
    await expect(
      host.page.getByRole("button", { name: /New meeting/ }),
    ).toBeVisible();
    await expect(
      host.page.getByText(/Your meetings are demos for now/),
    ).toHaveCount(0);

    // Removing the address takes it off the list.
    await row
      .getByRole("button", { name: `Remove ${invitee} from approved hosts` })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(row).toHaveCount(0);

    expectNoErrors(admin, visitor, host);
  });

  test("the list and form work on a phone, in dark mode, by keyboard", async ({
    people,
  }) => {
    const admin = await people.signedIn({
      email: HOSTS_ADMIN_EMAIL,
      name: "Hana Admin",
      viewport: { width: 375, height: 812 },
    });
    const { page } = admin;
    await page.emulateMedia({ colorScheme: "dark" });
    const invitee = `e2e_invite_${Date.now().toString(36)}k@faceon.test`;
    await page.goto("/settings/admin");
    const field = page.getByLabel("Email address");
    // Keys pressed while the page is still loading can be lost (CI caught Enter there):
    // this test is about the phone layout and the keyboard, so it waits for React first.
    await hydrated(field);
    await field.focus();
    await page.keyboard.type(invitee);
    await page.keyboard.press("Enter");
    const row = page.getByRole("listitem").filter({ hasText: invitee });
    const copy = row.getByRole("button", {
      name: `Copy an invite link for ${invitee}`,
    });
    await expect(copy).toBeVisible();
    // Nothing on the page is wider than the phone.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // The copy button is reachable and shows its focus.
    await copy.focus();
    await expect(copy).toBeFocused();
    expectNoErrors(admin);
  });
});
