import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Quick Coach Visual Journey", () => {
  test("renders Quick Coach, plays story, interacts with coach, and saves goal with screenshots", async ({
    page,
  }, testInfo) => {
    // Only run screenshots once (on Mobile Pixel project)
    if (testInfo.project.name !== "Mobile Pixel") {
      return;
    }

    const tmpDir = path.resolve(process.cwd(), "../tmp");

    // 1. Mock Session & CSRF
    await page.route("**/api/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "usr-1",
            name: "Sarah",
            email: "sarah@example.com",
            agreementsSigned: true,
            nightscoutUrl: "https://nightscout.example.com",
            preferredUnits: "MGDL",
          },
        }),
      });
    });

    await page.route("**/api/csrf-token", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ csrfToken: "mock-csrf-token" }),
      });
    });

    // 2. Mock Journal Data with Primary Focus Cluster & Story
    await page.route("**/api/journals/test-coach-id", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "ok" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-coach-id",
          startDate: "2026-09-08T00:00:00.000Z",
          endDate: "2026-09-14T23:59:59.000Z",
          weeklyVibe: "Tired",
          goalsForNextWeek: null,
          clusters: [
            {
              id: "cluster-lunch",
              eventType: "hyper",
              eventCount: 4,
              meanTimeMinutes: 810, // 1:30 PM
              isPrimaryFocus: true,
              clusterDataJson: {
                id: "cluster-lunch",
                type: "hyper",
                avgStartMinute: 810,
                events: [],
              },
              aiInsight: {
                observation:
                  "High blood sugar spikes consistently after weekday lunches.",
                quickCoachStory: {
                  audio_script:
                    "Let's look at your post-lunch numbers this week. Around 1:30 PM, we noticed consistent highs across several afternoons. Notice how the trend rises steadily after meals.",
                  animation_cues: [
                    { time_ms: 0, action: "DRAW_MEAN", label: "Average Trend" },
                    {
                      time_ms: 800,
                      action: "DRAW_DAY",
                      day_index: 0,
                      label: "Monday Trace",
                    },
                    {
                      time_ms: 1400,
                      action: "DRAW_TREATMENTS",
                      day_index: 0,
                      label: "Lunch Bolus",
                    },
                    {
                      time_ms: 2000,
                      action: "DRAW_DAY",
                      day_index: 1,
                      label: "Wednesday Trace",
                    },
                  ],
                },
              },
            },
          ],
        }),
      });
    });

    // 3. Mock Chat Endpoint
    await page.route(
      "**/api/journals/test-coach-id/clusters/cluster-lunch/chat",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply:
              "Taking a 10-15 minute walk right after lunch on weekdays can help smooth out that post-meal rise.",
          }),
        });
      },
    );

    // Navigate to Quick Coach route
    await page.goto("/coach/test-coach-id");

    // Wait for header and story player to mount
    await expect(page.locator("text=Quick Coach")).toBeVisible();
    await expect(page.locator("text=Primary Weekly Hotspot")).toBeVisible();
    await page.waitForTimeout(500);

    // Snapshot 1: Initial View
    await page.screenshot({
      path: path.join(tmpDir, "quick-coach-01-initial-view.png"),
      fullPage: true,
    });

    // Click Play Story
    const playBtn = page.getByRole("button", {
      name: /Play Data Story|Play Story/i,
    });
    await playBtn.click();

    // Wait 2.2 seconds for animation cues to stack
    await page.waitForTimeout(2200);

    // Snapshot 2: Story Playing with Stacked Traces
    await page.screenshot({
      path: path.join(tmpDir, "quick-coach-02-story-playing.png"),
      fullPage: true,
    });

    // Fast-forward or wait until ready for reflection
    await page.waitForTimeout(4000);

    // Type in Reflection Input
    const input = page.getByPlaceholder("e.g. 10 minute walk after lunch");
    await input.fill("I want to take a walk after lunch");

    const sendBtn = page.getByRole("button", { name: "Send Message" });
    await sendBtn.click();

    // Wait for AI reply and Proposed Goal Card
    await expect(page.locator("text=Proposed Weekly Micro-Habit")).toBeVisible({
      timeout: 5000,
    });

    // Snapshot 3: Voice Negotiation with Proposed Micro-Habit
    await page.screenshot({
      path: path.join(tmpDir, "quick-coach-03-voice-negotiation.png"),
      fullPage: true,
    });

    // Click "Set as Weekly Micro-Habit"
    const setHabitBtn = page.getByRole("button", {
      name: "Set as Weekly Micro-Habit",
    });
    await setHabitBtn.click();

    // Sticky Action Bar "Accept & Save" should appear
    const acceptSaveBtn = page.getByRole("button", { name: "Accept & Save" });
    await expect(acceptSaveBtn).toBeVisible();

    // Click Accept & Save
    await acceptSaveBtn.click();

    // Wait for celebration modal
    await expect(page.locator("text=Micro-Habit Locked In!")).toBeVisible({
      timeout: 5000,
    });

    // Snapshot 4: Goal Saved & Celebration Modal
    await page.screenshot({
      path: path.join(tmpDir, "quick-coach-04-goal-locked.png"),
      fullPage: true,
    });
  });
});
