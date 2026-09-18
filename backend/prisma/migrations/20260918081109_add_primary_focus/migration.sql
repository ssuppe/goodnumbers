-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GlycemicEventCluster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "meanTimeMinutes" INTEGER NOT NULL,
    "isPrimaryFocus" BOOLEAN NOT NULL DEFAULT false,
    "clusterDataJson" JSONB NOT NULL,
    "userNotes" TEXT,
    "insights" JSONB,
    "aiInsight" JSONB,
    "quickLogSuggestions" JSONB,
    CONSTRAINT "GlycemicEventCluster_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GlycemicEventCluster" ("aiInsight", "clusterDataJson", "eventCount", "eventType", "id", "insights", "journalId", "meanTimeMinutes", "quickLogSuggestions", "userNotes") SELECT "aiInsight", "clusterDataJson", "eventCount", "eventType", "id", "insights", "journalId", "meanTimeMinutes", "quickLogSuggestions", "userNotes" FROM "GlycemicEventCluster";
DROP TABLE "GlycemicEventCluster";
ALTER TABLE "new_GlycemicEventCluster" RENAME TO "GlycemicEventCluster";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
