// export interface PodcastInfo {
//   valid: boolean;
//   title: string;
//   description: string;
//   ssml_dialog: string;
//   id: string;
// }

export interface PodcastGenerateResult {
  status: string;
  message: string;
  operation_id?: string;
  url: string;
  error?: string;
  gcs_path?: string;
  bucket_name?: string;
  title?: string | null;
  description?: string | null;
}

export type GlucoseUnits = 'mg/dl' | 'mmol/l';

export interface AssessmentData {
  valid?: boolean | null;
  notes?: string | null;
  assessment1?: string | null;
  assessment2?: string | null;
  title?: string | null;
  description?: string | null;
  ssml_dialog?: string | null;
  template_num?: number | 1;
  timestamp?: string | null;
  id?: string | null;
  podcastResult?: PodcastGenerateResult | null;
  preferred_units: GlucoseUnits;
}

export const hasCriticalInsights = (insights: AssessmentInsight[]): boolean => {
  const hasCritical = insights.some((insight) => insight.priority === InsightPriority.CRITICAL);
  return hasCritical;
};

export const filterCriticalInsights = (insights: AssessmentInsight[]): AssessmentInsight[] | null => {
  const hasCritical = insights.some((insight) => insight.priority === InsightPriority.CRITICAL);

  return hasCritical
    ? insights.filter(
        (insight) =>
          insight.priority === InsightPriority.CRITICAL || insight.priority === InsightPriority.ALWAYS_INCLUDE,
      )
    : null;
};

export const insightsToNotes = (insights: AssessmentInsight[]): string => {
  return insights.map((insight) => `[${InsightPriority[insight.priority]}] ${insight.note}`).join('\n');
};

export enum InsightPriority {
  ALWAYS_INCLUDE = -1,
  CRITICAL = 0,
  SERIOUS = 1,
  IMPORTANT = 2,
  INFO = 3,
}

export interface AssessmentInsight {
  note: string;
  priority: InsightPriority;
}

export interface InitialStoredData {
  notes: string | null;
  assessment1: string | null;
  assessment2: string | null;
  dialog: string | null;
  podcastResult: PodcastGenerateResult | null;
  timestamp: string | null;
}

export interface NightscoutData {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  profiles: NightscoutProfile[];
}

export interface NightscoutConfig {
  url: string;
  token: string;
}

export interface NightscoutEntry {
  _id: string;
  app: string;
  date: number;
  device: string;
  direction: string;
  isReadOnly: boolean;
  isValid: boolean;
  sgv: number;
  type: string;
  unfiltered: number;
  units: string;
  utcOffset: number;
  created_at: string;
  identifier: string;
  srvModified: number;
  srvCreated: number;
  subject: string;
  modifiedBy: string;
  mills: number;
}

export interface NightscoutTreatment {
  _id: string;
  app: string;
  date: number;
  duration: number;
  durationInMilliseconds: number;
  enteredBy: string;
  eventType: string;
  isReadOnly: boolean;
  isValid: boolean;
  notes: string;
  units: string;
  utcOffset: number;
  created_at: string;
  identifier: string;
  srvModified: number;
  srvCreated: number;
  subject: string;
  carbs: number | null;
  insulin: number | null;
}

export interface DateRange {
  profile: NightscoutProfile;
  startDate: Date;
  endDate: Date;
  daysActive: number;
}

export interface TimeValue {
  time: string;
  timeAsSeconds: number;
  value: number;
}

export interface NSProfileSettings {
  dia: number;
  carbratio: TimeValue[];
  sens: TimeValue[];
  basal: TimeValue[];
  target_low: TimeValue[];
  target_high: TimeValue[];
  units: string;
  timezone: string;
}

export interface NightscoutProfile {
  _id: string;
  defaultProfile: string;
  startDate: string;
  store: Record<string, NSProfileSettings>;
  identifier: string;
  date: number;
  created_at: string;
  app: string;
  utcOffset: number;
  srvModified: number;
  srvCreated: number;
  subject: string;
}

export interface JobCheckResponse {
  name?: string;
  done?: boolean;
  status?: 'done' | 'error' | 'unknown' | 'processing';
  error?: string | null; // Or the specific type if known
  result?: string | null; // Or the specific type if known
}
