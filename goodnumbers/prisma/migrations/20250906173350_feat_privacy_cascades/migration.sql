-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
