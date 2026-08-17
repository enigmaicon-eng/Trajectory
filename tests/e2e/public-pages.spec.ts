import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("landing page", () => {
  test("renders the goal capture form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("form")).toBeVisible();
  });

  test("has no automatically detectable accessibility violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("full keyboard traversal reaches the submit control with visible focus", async ({ page }) => {
    await page.goto("/");
    // The submit button is disabled (and unfocusable) until there is input —
    // exercise the real flow rather than tabbing over an inert control.
    await page.getByPlaceholder(/what do you want to accomplish/i).fill("Run a marathon");
    await page.keyboard.press("Tab");
    // Scope to <main> — Next.js dev tools render a floating portal button
    // outside the app that would otherwise grab focus in this harness.
    const active = page.locator("main :focus");
    await expect(active).toBeVisible();
    await expect(active).toHaveRole("button");
    // Buttons use a focus-visible box-shadow ring (Tailwind `ring-2`) rather
    // than the native outline, so a visible indicator is either one.
    const { outline, boxShadow } = await active.evaluate((el) => {
      const style = getComputedStyle(el);
      return { outline: style.outlineStyle, boxShadow: style.boxShadow };
    });
    expect(outline !== "none" || boxShadow !== "none").toBe(true);
  });
});

test.describe("sign-in page", () => {
  test("renders and is accessible", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(page.locator("body")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});

test.describe("auth gate", () => {
  test("unauthenticated visitors are redirected off protected routes", async ({ page }) => {
    await page.goto("/goals");
    await page.waitForURL(/\/auth\/sign-in/);
    expect(page.url()).toContain("/auth/sign-in");
  });
});

test.describe("not-found page", () => {
  test("renders a recovery action, not a dead end", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByRole("link", { name: /back to your goals/i })).toBeVisible();
  });
});

test.describe("360px viewport", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("landing page has no horizontal overflow at 360px", async ({ page }) => {
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
