import { config } from "dotenv";
config({ path: ".env" });
import { processJournalJob } from "./backend/src/worker.js";
import { prisma } from "./backend/src/lib/prisma.js";

async function main() {
  const journalId = "cmpwdku3g0001v7jw6a863qdg";
  // We need to pass a mock job object
  const mockJob = {
    id: "mock-job-id",
    data: { journalId },
  } as any;

  // Clear out the existing clusters so we can see what happens
  await prisma.glycemicEventCluster.deleteMany({
    where: { journalId },
  });

  console.log(`Processing journal ${journalId}...`);
  await processJournalJob(mockJob);
  console.log(`Done.`);

  // Fetch the clusters saved
  const clusters = await prisma.glycemicEventCluster.findMany({
    where: { journalId },
  });
  console.log(`Found ${clusters.length} clusters in DB.`);
  clusters.forEach((c) => {
    console.log(
      `  - Cluster: ${c.eventType}, Count: ${c.eventCount}, AvgStart: ${c.meanTimeMinutes}`,
    );
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
