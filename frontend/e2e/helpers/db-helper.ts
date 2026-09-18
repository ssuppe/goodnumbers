import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

export interface RealCoachingData {
  journal: {
    id: string;
    startDate: string;
    endDate: string;
    weeklyVibe: string;
    goalsForNextWeek: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
    agreementsSigned: boolean;
    nightscoutUrl: string;
    preferredUnits: string;
  };
  primaryCluster: {
    id: string;
    journalId: string;
    eventType: string;
    eventCount: number;
    meanTimeMinutes: number;
    isPrimaryFocus: boolean;
    clusterDataJson: Record<string, unknown>;
    aiInsight: Record<string, unknown>;
  };
  allClusters: Array<{
    id: string;
    journalId: string;
    eventType: string;
    eventCount: number;
    meanTimeMinutes: number;
    isPrimaryFocus: boolean;
    clusterDataJson: Record<string, unknown>;
    aiInsight: Record<string, unknown>;
  }>;
}

import { fileURLToPath } from "node:url";

const currentDir = fileURLToPath(new URL(".", import.meta.url));

export function getDevDbPath(): string {
  // Check typical locations relative to execution cwd
  const candidates = [
    path.resolve(process.cwd(), "backend/prisma/dev.db"),
    path.resolve(process.cwd(), "../backend/prisma/dev.db"),
    path.resolve(currentDir, "../../../backend/prisma/dev.db"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error(
    `SQLite database dev.db not found. Searched paths:\n${candidates.join("\n")}`,
  );
}

export function loadRealCoachingScenario(): RealCoachingData {
  const dbPath = getDevDbPath();
  const db = new DatabaseSync(dbPath);

  // 1. Locate primary focus cluster or top recurring cluster
  let primaryClusterRow = db
    .prepare(
      "SELECT * FROM GlycemicEventCluster WHERE isPrimaryFocus = 1 LIMIT 1",
    )
    .get() as Record<string, unknown> | undefined;

  if (!primaryClusterRow) {
    // Fallback: pick cluster with highest event count
    primaryClusterRow = db
      .prepare(
        "SELECT * FROM GlycemicEventCluster ORDER BY eventCount DESC LIMIT 1",
      )
      .get() as Record<string, unknown> | undefined;
  }

  if (!primaryClusterRow) {
    throw new Error("No GlycemicEventCluster records found in dev.db");
  }

  const journalId = primaryClusterRow.journalId as string;

  // 2. Fetch journal record
  const journalRow = db
    .prepare("SELECT * FROM Journal WHERE id = ?")
    .get(journalId) as Record<string, unknown>;

  if (!journalRow) {
    throw new Error(`Journal ${journalId} not found in dev.db`);
  }

  // 3. Fetch user record
  const userRow = db
    .prepare("SELECT * FROM User WHERE id = ?")
    .get(journalRow.userId as string) as Record<string, unknown> | undefined;

  // 4. Fetch all clusters for this journal
  const clusterRows = db
    .prepare(
      "SELECT * FROM GlycemicEventCluster WHERE journalId = ? ORDER BY meanTimeMinutes ASC",
    )
    .all(journalId) as Array<Record<string, unknown>>;

  const parseCluster = (row: Record<string, unknown>) => ({
    id: row.id as string,
    journalId: row.journalId as string,
    eventType: row.eventType as string,
    eventCount: Number(row.eventCount),
    meanTimeMinutes: Number(row.meanTimeMinutes),
    isPrimaryFocus: Boolean(row.isPrimaryFocus),
    clusterDataJson: JSON.parse(row.clusterDataJson as string),
    aiInsight: row.aiInsight ? JSON.parse(row.aiInsight as string) : {},
  });

  const parsedClusters = clusterRows.map(parseCluster);
  const primaryCluster = parseCluster(primaryClusterRow);

  return {
    journal: {
      id: journalId,
      startDate: (journalRow.startDate as string) || "2026-06-16T00:00:00.000Z",
      endDate: (journalRow.endDate as string) || "2026-06-22T23:59:59.000Z",
      weeklyVibe: (journalRow.weeklyVibe as string) || "Tired",
      goalsForNextWeek: (journalRow.goalsForNextWeek as string) || null,
      treatments: journalRow.treatments
        ? JSON.parse(journalRow.treatments as string)
        : [],
    },
    user: {
      id: (userRow?.id as string) || "usr-patient",
      name: (userRow?.name as string) || "Patient",
      email: (userRow?.email as string) || "goodnumbersmain@gmail.com",
      agreementsSigned: true,
      nightscoutUrl: "https://nightscout.example.com",
      preferredUnits: (userRow?.preferredUnits as string) || "MMOL",
    },
    primaryCluster,
    allClusters: parsedClusters,
  };
}

export function updateJournalGoalInDb(
  journalId: string,
  goalsForNextWeek: string,
): void {
  const dbPath = getDevDbPath();
  const db = new DatabaseSync(dbPath);
  db.prepare("UPDATE Journal SET goalsForNextWeek = ? WHERE id = ?").run(
    goalsForNextWeek,
    journalId,
  );
}

export function getJournalGoalFromDb(journalId: string): string | null {
  const dbPath = getDevDbPath();
  const db = new DatabaseSync(dbPath);
  const row = db
    .prepare("SELECT goalsForNextWeek FROM Journal WHERE id = ?")
    .get(journalId) as { goalsForNextWeek: string | null } | undefined;
  return row?.goalsForNextWeek ?? null;
}
