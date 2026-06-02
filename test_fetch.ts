import { config } from "dotenv";
config();
import { NightscoutClient } from "./backend/src/lib/nightscout/client.js";

async function main() {
  const url = process.env.TEST_NIGHTSCOUT_URL;
  const token = process.env.TEST_NIGHTSCOUT_TOKEN;
  if (!url || !token) {
    console.error("No url or token");
    return;
  }
  const client = new NightscoutClient(url, token);
  const now = new Date();
  const fetchStart = new Date(now);
  fetchStart.setDate(fetchStart.getDate() - 7);
  fetchStart.setHours(fetchStart.getHours() - 3);
  const fetchEnd = new Date(now);
  fetchEnd.setHours(fetchEnd.getHours() + 3);

  console.log(
    `Fetching from ${fetchStart.toISOString()} to ${fetchEnd.toISOString()}`,
  );
  const entries = await client.fetchEntries(fetchStart, fetchEnd);
  console.log(`Fetched ${entries.length} entries.`);

  // Check if there are any below 70
  const lows = entries.filter((e) => e.sgv < 70);
  console.log(`Lows (<70): ${lows.length}`);
}

main().catch(console.error);
