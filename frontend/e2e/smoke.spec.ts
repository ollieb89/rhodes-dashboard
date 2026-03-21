import { test, expect } from "@playwright/test";

test.describe("Dashboard smoke tests", () => {
  test("Overview page loads and shows heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("Products page loads and shows heading + repo cards", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    // Wait for at least one repo card or the search input
    await expect(page.getByPlaceholder("Search repos...")).toBeVisible();
  });

  test("Content page loads and shows tabs", async ({ page }) => {
    await page.goto("/content");
    await expect(page.getByRole("heading", { name: "Content" })).toBeVisible();
    // Tabs should be present
    await expect(page.getByRole("tab")).toHaveCount(2);
  });

  test("Agents page loads and renders agent UI", async ({ page }) => {
    await page.goto("/agents");
    await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
    // Refresh button should be visible
    await expect(page.getByRole("button", { name: /refresh/i })).toBeVisible();
  });

  test("Metrics page loads and shows heading", async ({ page }) => {
    await page.goto("/metrics");
    await expect(page.getByRole("heading", { name: "Metrics" })).toBeVisible();
  });

  test("Incidents page loads", async ({ page }) => {
    await page.goto("/incidents");
    await expect(page.getByRole("heading", { name: "Incidents" })).toBeVisible();
  });

  test("Sidebar navigation links are visible", async ({ page }) => {
    await page.goto("/");
    // Check sidebar nav items exist (desktop)
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Products" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Agents" })).toBeVisible();
  });
});
