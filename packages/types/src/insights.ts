export enum InsightPriority {
  CRITICAL = "CRITICAL",
  SERIOUS = "SERIOUS",
  IMPORTANT = "IMPORTANT",
  INFO = "ALWAYS_INCLUDE",
}

export interface Insight {
  priority: InsightPriority;
  note: string;
}
