import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import {
  loadRealCoachingScenario,
  updateJournalGoalInDb,
  getJournalGoalFromDb,
} from "./helpers/db-helper";

test.describe("Quick Coach Visual Journey & Real-Time Video", () => {
  test("records Quick Coach multistep 3-chart journey with real SQLite data and verifies animation", async ({
    browser,
  }, testInfo) => {
    // Run full video recording on Mobile Pixel project
    if (testInfo.project.name !== "Mobile Pixel") {
      return;
    }

    const tmpDir = path.resolve(process.cwd(), "../tmp");
    const videoDir = path.resolve(tmpDir, "videos");
    await fs.promises.mkdir(videoDir, { recursive: true });

    // 1. Load Real Data from SQLite dev.db
    const scenario = loadRealCoachingScenario();
    console.log(`[E2E] Loaded real scenario from SQLite:`);
    console.log(` - Journal ID: ${scenario.journal.id}`);
    console.log(` - Primary Cluster ID: ${scenario.primaryCluster.id}`);
    console.log(
      ` - Event Type: ${scenario.primaryCluster.eventType}, Count: ${scenario.primaryCluster.eventCount}, MeanTime: ${scenario.primaryCluster.meanTimeMinutes}`,
    );

    // 2. Launch Context with Explicit Video Recording
    const context = await browser.newContext({
      ...testInfo.project.use,
      recordVideo: {
        dir: videoDir,
        size: { width: 412, height: 915 },
      },
    });

    const page = await context.newPage();

    // 3. Mock Auth Session with Real SQLite User
    await page.route("**/api/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: scenario.user,
        }),
      });
    });

    await page.route("**/api/csrf-token", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ csrfToken: "mock-csrf-token-real-db" }),
      });
    });

    // 4. Mock Journal Endpoints Driven by SQLite dev.db (including treatments)
    await page.route(
      `**/api/journals/${scenario.journal.id}`,
      async (route) => {
        if (route.request().method() === "PUT") {
          const postData = route.request().postDataJSON() as {
            goalsForNextWeek?: string;
          };
          if (postData?.goalsForNextWeek) {
            // Persist directly to real SQLite dev.db
            updateJournalGoalInDb(
              scenario.journal.id,
              postData.goalsForNextWeek,
            );
            console.log(
              `[E2E] Persisted micro-habit into SQLite dev.db: "${postData.goalsForNextWeek}"`,
            );
          }
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
          });
          return;
        }

        // Return real journal with clusters and CGM readings from SQLite
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...scenario.journal,
            clusters: scenario.allClusters,
          }),
        });
      },
    );

    // 5. Mock Chat Reflection Endpoint
    await page.route(
      `**/api/journals/${scenario.journal.id}/clusters/${scenario.primaryCluster.id}/chat`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply:
              "A 15-minute light walk right after dinner is an effective micro-habit to smooth that evening rise. Let's commit to a 15-minute post-dinner walk on 3 weekdays.",
          }),
        });
      },
    );

    // 6. Navigate to Quick Coach route
    await page.goto(`/coach/${scenario.journal.id}`);

    // Wait for header and story player to mount
    await expect(page.locator("text=Quick Coach")).toBeVisible();
    await expect(page.locator("text=Primary Weekly Hotspot")).toBeVisible();
    await expect(page.locator("text=Occurred 3x")).toBeVisible();
    await page.waitForTimeout(800);

    // STEP 1: Mean Only (Blood Glucose only)
    await expect(page.getByText(/Average Trend/i).first()).toBeVisible();
    await page.waitForTimeout(1200);

    // Verify chart is fully visible in viewport and not clipped at the top
    const chartBoxStep1 = await page
      .getByTestId("echarts-story-container")
      .boundingBox();
    expect(chartBoxStep1).not.toBeNull();
    expect(chartBoxStep1!.y).toBeGreaterThanOrEqual(40);
    expect(chartBoxStep1!.y + chartBoxStep1!.height).toBeLessThan(750);

    // Snapshot 1: Step 1 - Mean Curve Only
    await page.screenshot({
      path: path.join(tmpDir, "quick-coach-01-initial-mean.png"),
      fullPage: true,
    });

    const nextBtn = page.getByRole("button", { name: "Next Step" });

    // STEP 2: Day 1 - Thursday (Glucose line + Carbs bars + Insulin bars)
    await nextBtn.click();
    await expect(page.getByText(/Thursday: Trace/i)).toBeVisible();
    await expect(page.getByText(/look at Thursday/i)).toBeVisible();
    // Wait for lines and bar animation to draw in video
    await page.waitForTimeout(2000);

    // Verify chart remains fully in view after clicking Next
    const chartBoxStep2 = await page
      .getByTestId("echarts-story-container")
      .boundingBox();
    expect(chartBoxStep2).not.toBeNull();
    expect(chartBoxStep2!.y).toBeGreaterThanOrEqual(40);
    expect(chartBoxStep2!.y + chartBoxStep2!.height).toBeLessThan(750);

    // Snapshot 2: Day 1 - Thursday Trace & Treatments
    await page.screenshot({
      path: path.join(tmpDir, "quick-coach-02-day1-thursday-treatments.png"),
      fullPage: true,
    });

    // STEP 3: Day 2 - Sunday (Animates in Sunday line + carbs + insulin)
    await nextBtn.click();
    await expect(page.getByText(/Sunday: Trace/i)).toBeVisible();
    await expect(page.getByText(/look at Sunday/i)).toBeVisible();
    await page.waitForTimeout(2000);

    // Snapshot 3: Day 2 - Sunday Trace & Treatments
    await page.screenshot({
      path: path.join(tmpDir, "quick-coach-03-day2-sunday-treatments.png"),
      fullPage: true,
    });

    // STEP 4: Day 3 - Monday (Animates in Monday line + carbs + insulin)
    await nextBtn.click();
    await expect(page.getByText(/Monday: Trace/i)).toBeVisible();
    await expect(page.getByText(/look at Monday/i)).toBeVisible();
    await page.waitForTimeout(2000);

    // Snapshot 4: Day 3 - Monday Trace & Treatments
    await page.screenshot({
      path: path.join(tmpDir, "quick-coach-04-day3-monday-treatments.png"),
      fullPage: true,
    });

    // STEP 5: Wrap-up & Reflection
    await nextBtn.click();
    await expect(page.getByText(/Ready for Reflection/i).first()).toBeVisible();
    await page.waitForTimeout(1500);

    // Snapshot 5: Story Completed and Ready for Reflection
    await page.screenshot({
      path: path.join(tmpDir, "quick-coach-05-story-completed.png"),
      fullPage: true,
    });

    // 7. Push-to-Talk / Text Micro-Habit Negotiation
    const input = page.getByPlaceholder("e.g. 10 minute walk after lunch");
    await input.fill("I want to do a 15-minute walk after dinner");
    await page.waitForTimeout(500);

    const sendBtn = page.getByRole("button", { name: "Send Message" });
    await sendBtn.click();

    // Wait for Gemini coaching reflection card
    await expect(page.locator("text=Proposed Weekly Micro-Habit")).toBeVisible({
      timeout: 6000,
    });
    await page.waitForTimeout(1000);

    // Snapshot 6: Voice Negotiation Proposed Goal
    await page.screenshot({
      path: path.join(tmpDir, "quick-coach-06-habit-negotiation.png"),
      fullPage: true,
    });

    // 8. Handshake & Goal Persistence
    const setHabitBtn = page.getByRole("button", {
      name: "Set as Weekly Micro-Habit",
    });
    await setHabitBtn.click();

    // Sticky Action Bar "Accept & Save" appears
    const acceptSaveBtn = page.getByRole("button", { name: "Accept & Save" });
    await expect(acceptSaveBtn).toBeVisible();
    await page.waitForTimeout(800);

    // Click Accept & Save
    await acceptSaveBtn.click();

    // Wait for celebration modal
    await expect(page.locator("text=Micro-Habit Locked In!")).toBeVisible({
      timeout: 6000,
    });

    // Snapshot 7: Celebration Modal Confetti
    await page.screenshot({
      path: path.join(tmpDir, "quick-coach-07-goal-celebration.png"),
      fullPage: true,
    });

    // Keep celebration visible briefly for video recording
    await page.waitForTimeout(1800);

    // 9. Verify SQLite Database State
    const persistedGoal = getJournalGoalFromDb(scenario.journal.id);
    expect(persistedGoal).toMatch(/walk.*dinner/i);
    console.log(
      `[E2E Verification] Confirmed goal in SQLite dev.db: "${persistedGoal}"`,
    );

    // 10. Finalize & Save Video
    const video = page.video();
    const finalVideoPath = path.join(videoDir, "quick-coach-journey.webm");

    // Save video promise before closing context
    const savePromise = video?.saveAs(finalVideoPath);
    await context.close();
    await savePromise;

    expect(fs.existsSync(finalVideoPath)).toBe(true);
    const videoStats = fs.statSync(finalVideoPath);
    console.log(
      `\n======================================================\n🎥 Video Recorded Successfully!\n Location: ${finalVideoPath}\n Size: ${(videoStats.size / 1024).toFixed(1)} KB\n======================================================\n`,
    );
  });
});
