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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
