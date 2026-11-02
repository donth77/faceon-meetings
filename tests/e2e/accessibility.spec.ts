import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";

import { expect, expectNoErrors, test } from "./support/fixtures";

/** Serious and critical WCAG 2.x A and AA problems axe finds on the page. */
async function axeProblems(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
}

/**
 * Everything you can press shows the pointing hand, and text fields keep their caret
 * (the base rule in globals.css). Returns what breaks it.
 */
function cursorProblems(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return box.width > 0 && box.height > 0 && style.visibility !== "hidden";
    };
    const disabled = (el: Element) =>
      el.matches(":disabled, [aria-disabled=true], [data-disabled]") ||
      getComputedStyle(el).pointerEvents === "none";
    const pressable =
      "a[href], button, select, input[type=checkbox], input[type=radio], [role=button], [role=link], [role=tab], [role=option], [role=menuitem], [role=switch], [role=checkbox], [role=radio]";
    const typing =
      "input:not([type]), input[type=text], input[type=email], input[type=password], input[type=search], textarea";
    const problems: string[] = [];
    for (const el of document.querySelectorAll(pressable)) {
      if (!visible(el) || disabled(el)) continue;
      const cursor = getComputedStyle(el).cursor;
      if (cursor !== "pointer") {
        problems.push(
          `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}" → ${cursor}`,
        );
      }
    }
    for (const el of document.querySelectorAll(typing)) {
      if (visible(el) && getComputedStyle(el).cursor === "pointer") {
        problems.push(`text field ${el.getAttribute("name") ?? ""} → pointer`);
      }
    }
    return problems;
  });
}

test.describe("accessibility", () => {
  test("signed-out pages pass axe and use the pointing hand", async ({
    people,
  }) => {
    const visitor = await people.guest();
    const { page } = visitor;
    for (const path of [
      "/",
      "/sign-in",
      "/sign-up",
      "/help",
      "/privacy",
      "/credits",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await axeProblems(page), path).toEqual([]);
      expect(await cursorProblems(page), path).toEqual([]);
    }
    expectNoErrors(visitor);
  });

  test("signed-in pages pass axe and use the pointing hand", async ({
    people,
  }) => {
    const host = await people.signedIn();
    const { page } = host;
    for (const path of [
      "/home",
      "/upcoming",
      "/previous",
      "/schedule",
      "/settings",
      "/personal-room",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeAttached();
      await expect(page.locator("main")).toBeVisible();
      expect(await axeProblems(page), path).toEqual([]);
      expect(await cursorProblems(page), path).toEqual([]);
    }
    expectNoErrors(host);
  });
});
