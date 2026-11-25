import { test, expect } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

test("records solo and group challenge attempts and displays personal bests", async ({ page }) => {
  test.setTimeout(45_000);
  const { groupId } = await createTestGroup(page, `Training Group ${Date.now()}`);

  // Navigate to training via nav link
  await page.getByRole("link", { name: "Training", exact: true }).first().click();
  await expect(page).toHaveURL(/\/training/);
  await expect(page.getByRole("heading", { name: "Training & Challenges", exact: true })).toBeVisible();

  // Find the Wall Dink Rally Streak card
  const wallCard = page.getByTestId("challenge-card-ch_wall_streak_100");
  await expect(wallCard).toBeVisible();

  // Record an attempt directly from the card
  await wallCard.getByRole("button", { name: "+ Record Attempt" }).click();
  await wallCard.locator("input[type='number']").fill("42");
  await wallCard.getByRole("button", { name: "Save Attempt" }).click();

  // Verify personal best badge updates
  await expect(wallCard.getByText("42 dinks").first()).toBeVisible();
  await expect(wallCard.getByText("✓ Done")).toBeVisible();

  // Undo the attempt: the personal best and Done badge roll back
  await wallCard.getByRole("button", { name: "Undo" }).click();
  await expect(wallCard.getByText("Attempt removed.")).toBeVisible();
  await expect(wallCard.getByText("No attempts yet")).toBeVisible();
  await expect(wallCard.getByText("✓ Done")).toHaveCount(0);

  // Save it again (the form keeps the entered values)
  await wallCard.getByRole("button", { name: "Save Attempt" }).click();
  await expect(wallCard.getByText("42 dinks").first()).toBeVisible();
  await expect(wallCard.getByText("✓ Done")).toBeVisible();
  await expect(wallCard.getByTestId("last-result-ch_wall_streak_100")).toContainText("Last time");

  // Open the drill history: one attempt is shown as the starting point
  await wallCard.getByRole("link", { name: /history$/i }).first().click();
  await expect(page).toHaveURL(/\/training\/drills\/ch_wall_streak_100/);
  await expect(page.getByTestId("drill-trend-headline")).toContainText("Starting point: 42 dinks");
  await expect(page.getByRole("heading", { name: "Attempts" })).toBeVisible();
  await page.getByRole("link", { name: "← Training" }).click();
  await expect(page).toHaveURL(/\/training$/);

  // Navigate back to group and publish a weekly training plan
  await page.goto(`/g/${groupId}`);
  const trainingCard = page.getByTestId("weekly-training-card");
  await expect(trainingCard).toBeVisible();
  await trainingCard.getByRole("link", { name: "Create Weekly Plan →" }).click();
  await expect(page).toHaveURL(new RegExp(`/g/${groupId}/training/plan/new`));

  // Publish plan
  await page.getByRole("button", { name: "Publish Weekly Plan →" }).click();
  await expect(page).toHaveURL(new RegExp(`/g/${groupId}$`));

  // Verify published plan is displayed on dashboard and navigate to group's weekly drills
  await expect(trainingCard.getByText(/Week of .+ Training/)).toBeVisible();
  await trainingCard.getByRole("link", { name: "Practice Weekly Drills →" }).click();
  await expect(page).toHaveURL(new RegExp(`/training\\?group=${groupId}`));
  await expect(page.getByTestId("group-training-header")).toBeVisible();

  // Test Personal Weekly Training Plan creation
  await page.goto("/training");
  const personalCard = page.getByTestId("personal-training-plan-card");
  await expect(personalCard).toBeVisible();
  await personalCard.getByRole("link", { name: /Build My Weekly Plan|Edit My Plan/ }).click();
  await expect(page).toHaveURL(/\/training\/plan\/new/);
  await page.getByRole("button", { name: "Save Weekly Training Plan →" }).click();
  await expect(page).toHaveURL(/\/training$/);
  await expect(personalCard.getByText(/Week of .+ Personal Goals/)).toBeVisible();
});

