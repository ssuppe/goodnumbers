import { config } from "dotenv";
config({ path: ".env" });
import { NightscoutClient } from "./backend/src/lib/nightscout/client.js";
import { HotspotDetector } from "./backend/src/lib/analysis/HotspotDetector.js";
import { DateTime } from "luxon";
import { decrypt } from "./backend/src/lib/encryption.js";

async function main() {
  const url = "https://soopaloop.bbs.io";
  const encryptedToken =
    "3KaX7gifYoRor/Vl:9k7HCW4Zo8WBEgGTk9gfBw==:9/h/HfBGtpi6K9eRZvGb9gL/LDUeQf9fpQ==";
  const token = decrypt(encryptedToken);

  const client = new NightscoutClient(url, token);

  // Fetch last 7 days
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
  console.log(
    `Entries with undefined utcOffset: ${entries.filter((e) => e.utcOffset === undefined).length}`,
  );

  const lows = entries.filter((e) => e.sgv < 70);
  console.log(`Lows (<70): ${lows.length}`);
  lows.forEach((e) =>
    console.log(`  - Low: ${new Date(e.date).toISOString()}, sgv: ${e.sgv}`),
  );

  // Map entries exactly like worker.ts does
  const glucoseEntries = entries
    .map((e) => {
      // Reconstruct the LOCAL wall-clock time using the offset provided by Nightscout.
      const gmtOffset = -(e.utcOffset / 60);
      const zone = `Etc/GMT${gmtOffset >= 0 ? "+" : ""}${gmtOffset}`;
      let localDate;
      try {
        localDate = DateTime.fromMillis(e.date).setZone(zone);
      } catch (err) {
        // If zone is invalid, it throws. So localDate will be undefined.
      }

      return {
        sgv: e.sgv,
        date: e.date,
        dateString: localDate
          ? localDate.toISO()
          : new Date(e.date).toISOString(),
      };
    })
    .sort((a, b) => a.date - b.date); // Sort chronologically (ascending)

  const profiles = await client.fetchProfile();
  const defaultProfileName = profiles[0]?.defaultProfile;
  let userTimezone =
    defaultProfileName && profiles[0]?.store?.[defaultProfileName]?.timezone;
  console.log(`Profile timezone: ${userTimezone}`);

  // Simulate fallback
  if (
    !userTimezone &&
    entries.length > 0 &&
    entries[0].utcOffset !== undefined
  ) {
    const offsetMinutes = entries[0].utcOffset;
    const offsetHours = offsetMinutes / 60;
    const gmtOffset = -offsetHours;
    const sign = gmtOffset >= 0 ? "+" : "";
    userTimezone = `Etc/GMT${sign}${gmtOffset}`;
  }
  console.log(`Final userTimezone: ${userTimezone}`);

  const detector = new HotspotDetector(userTimezone || "UTC");
  const hyperEvents = detector.detectEvents(glucoseEntries, "hyper", 180);
  const hypoEvents = detector.detectEvents(glucoseEntries, "hypo", 70);

  console.log(`Detected ${hyperEvents.length} hyper events.`);
  hyperEvents.forEach((e) => {
    console.log(
      `  - Hyper: ${e.startTime} to ${e.endTime} (Duration: ${e.durationMinutes}m, StartMin: ${e.startMinuteOfDay})`,
    );
  });

  console.log(`Detected ${hypoEvents.length} hypo events.`);

  const hyperClusters = detector.findClusters(hyperEvents);
  console.log(`Found ${hyperClusters.length} hyper clusters.`);
  hyperClusters.forEach((c) => {
    console.log(
      `  - Cluster: ${c.eventCount} events, Days: ${c.activeDays.join(",")}, AvgStart: ${c.avgStartMinute}`,
    );
  });
}

main().catch(console.error);
