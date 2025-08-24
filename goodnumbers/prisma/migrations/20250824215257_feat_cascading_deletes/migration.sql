-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GlycemicEventCluster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "meanTimeMinutes" INTEGER NOT NULL,
    "clusterDataJson" JSONB NOT NULL,
    "userNotes" TEXT,
    CONSTRAINT "GlycemicEventCluster_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GlycemicEventCluster" ("clusterDataJson", "eventCount", "eventType", "id", "journalId", "meanTimeMinutes", "userNotes") SELECT "clusterDataJson", "eventCount", "eventType", "id", "journalId", "meanTimeMinutes", "userNotes" FROM "GlycemicEventCluster";
DROP TABLE "GlycemicEventCluster";
ALTER TABLE "new_GlycemicEventCluster" RENAME TO "GlycemicEventCluster";
CREATE TABLE "new_Journal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "statusMessage" TEXT,
    "weeklyVibe" TEXT,
    "influencingFactors" JSONB,
    "goalsForNextWeek" TEXT,
    "podcastTitle" TEXT,
    "podcastDescription" TEXT,
    "podcastAudioUrl" TEXT,
    "agpChartData" JSONB,
    "analysisInsights" JSONB,
    CONSTRAINT "Journal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Journal" ("agpChartData", "analysisInsights", "createdAt", "goalsForNextWeek", "id", "influencingFactors", "podcastAudioUrl", "podcastDescription", "podcastTitle", "progress", "status", "statusMessage", "updatedAt", "userId", "weeklyVibe") SELECT "agpChartData", "analysisInsights", "createdAt", "goalsForNextWeek", "id", "influencingFactors", "podcastAudioUrl", "podcastDescription", "podcastTitle", "progress", "status", "statusMessage", "updatedAt", "userId", "weeklyVibe" FROM "Journal";
DROP TABLE "Journal";
ALTER TABLE "new_Journal" RENAME TO "Journal";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
