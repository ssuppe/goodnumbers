export enum InsightPriority {
  CRITICAL = "CRITICAL",
  SERIOUS = "SERIOUS",
  IMPORTANT = "IMPORTANT",
  INFO = "ALWAYS_INCLUDE",
}

export interface Insight {
  priority: InsightPriority;
  note: string;
  /**
   * The number of minutes before the event startTime that contains relevant evidence.
   * Used by the frontend to dynamically expand the chart window.
   */
  evidenceWindowMins?: number;
}
