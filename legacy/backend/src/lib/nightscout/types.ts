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
