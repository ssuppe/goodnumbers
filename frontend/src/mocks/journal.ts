// file: frontend/src/mocks/journal.ts
import { type Journal, type GlycemicEventCluster } from "@goodnumbers/types";
import rawData from "./raw_journal_data.json";

export const mockJournalForView: Journal & {
  clusters: GlycemicEventCluster[];
} = {
  id: rawData.assessmentData.id,
  createdAt: new Date(rawData.timestamp),
  updatedAt: new Date(rawData.timestamp),
  userId: "mock-user-id",
  podcastTitle: rawData.assessmentData.podcastResult.title,
  podcastDescription: rawData.assessmentData.podcastResult.description,
  podcastAudioUrl: "/audio/mock-podcast.mp3",
  agpChartData: rawData.reportItems[0].data,
  analysisInsights: rawData.reportItems[0].insights,
  weeklyVibe: null,
  influencingFactors: [],
  goalsForNextWeek: null,
  clusters: [
    {
      id: "cluster-1",
      journalId: rawData.assessmentData.id,
      eventType: "HIGH",
      eventCount: 4,
      meanTimeMinutes: 404,
      clusterDataJson: rawData.reportItems[1].data[0],
      userNotes: null,
    },
    {
      id: "cluster-2",
      journalId: rawData.assessmentData.id,
      eventType: "VERY_HIGH",
      eventCount: 5,
      meanTimeMinutes: 1230,
      clusterDataJson: rawData.reportItems[2].data[0],
      userNotes: null,
    },
    {
      id: "cluster-3",
      journalId: rawData.assessmentData.id,
      eventType: "SEVERE_HYPOGLYCEMIA",
      eventCount: 4,
      meanTimeMinutes: 815,
      clusterDataJson: rawData.reportItems[3].data[0],
      userNotes: null,
    },
  ],
  status: "COMPLETE",
  progress: 100,
  statusMessage: "Your journal is ready.",
};
