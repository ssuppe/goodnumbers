import type { Journal } from "@goodnumbers/types";

export type JournalSummary = Pick<
  Journal,
  "id" | "createdAt" | "podcastTitle" | "podcastDescription" | "weeklyVibe"
>;
