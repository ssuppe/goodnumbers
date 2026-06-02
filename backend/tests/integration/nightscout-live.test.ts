import { describe, it, expect, beforeAll } from 'vitest';
import { NightscoutClient } from '../../src/lib/nightscout/client.js';

const liveUrl = process.env.TEST_NIGHTSCOUT_URL;
const liveToken = process.env.TEST_NIGHTSCOUT_TOKEN;

// We skip this suite entirely if the environment variables are not set.
const runLiveTests = liveUrl && liveToken ? describe : describe.skip;

runLiveTests('NightscoutClient Live Integration', { timeout: 30000 }, () => {
  let client: NightscoutClient;

  beforeAll(() => {
    // This block only runs if the suite is NOT skipped.
    console.log('DEBUG liveUrl:', JSON.stringify(liveUrl));
    if (!liveUrl || !liveToken) {
      throw new Error('Live credentials missing in beforeAll');
    }
    client = new NightscoutClient(liveUrl, liveToken);
  });

  it('should fetch real entries from the server', async () => {
    // Fetch just 1 day of data to be quick
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const entries = await client.fetchEntries(from, to);

    console.log(`[Live Test] Fetched ${entries.length} entries.`);

    expect(entries).toBeDefined();
    expect(Array.isArray(entries)).toBe(true);

    if (entries.length > 0) {
      expect(entries[0]).toHaveProperty('sgv');
      expect(entries[0]).toHaveProperty('date');
    }
  });

  it(
    'should fetch real treatments from the server',
    { timeout: 30000 },
    async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const treatments = await client.fetchTreatments(yesterday, now);
      console.log(`[Live Test] Fetched ${treatments.length} treatments.`);

      expect(treatments).toBeDefined();
      expect(Array.isArray(treatments)).toBe(true);
    },
  );

  it('should fetch the user profile', async () => {
    const profiles = await client.fetchProfile();
    console.log(`[Live Test] Fetched ${profiles.length} profiles.`);

    expect(profiles).toBeDefined();
    expect(Array.isArray(profiles)).toBe(true);
    if (profiles.length > 0) {
      expect(profiles[0]).toHaveProperty('store');
    }
  });
});
