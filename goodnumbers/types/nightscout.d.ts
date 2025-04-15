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

export type GlucoseUnits = 'mg/dl' | 'mmol/L';

export enum ReportType {
  AGP = 0,
  CLUSTER_LINE = 1,
}

export interface ReportItem {
  type: ReportType;
  insights: AssessmentInsight[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any[];
}

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
  preferred_units: GlucoseUnits | null;
  report_items?: ReportItem[] | null;
  patient_range?: PatientRange | null;
}

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

// Output interfaces - updated ISFProfile to match your needs
export interface BasalEntry {
  start: string;
  minutes: number;
  rate: number;
  untuned?: number;
}

export interface Sensitivity {
  i: number;
  start: string;
  sensitivity: number;
  offset: number;
  x: number;
  endOffset: number;
}

export interface ISFProfile {
  sensitivities: Sensitivity[];
}

export interface ATProfileSettings {
  min_5m_carbimpact: number;
  dia: number;
  basalprofile: BasalEntry[];
  isfProfile: ISFProfile;
  carb_ratio: number;
  autosens_max: number;
  autosens_min: number;
}
