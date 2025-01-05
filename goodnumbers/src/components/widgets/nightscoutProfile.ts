// export interface BasalProfileEntry {
//   start: string;
//   minutes: number;
//   rate: number;
// }

// export interface Sensitivity {
//   i: number;
//   start: string;
//   sensitivity: number;
//   offset: number;
//   x: number;
//   endOffset: number;
// }

// export interface ISFProfile {
//   sensitivities: Sensitivity[];
// }

// export interface ProfileSettings {
//   dia: number;
//   min_5m_carbimpact: number;
//   carb_ratio: TimeValue[];
//   sens: TimeValue[];
//   basal: TimeValue[];
//   target_low: TimeValue[];
//   target_high: TimeValue[];
//   units: string;
//   timezone: string;
// }

// interface TimeValue {
//   time: string;
//   timeAsSeconds: number;
//   value: number;
// }

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

interface DateRange {
  profile: NightscoutProfile;
  startDate: Date;
  endDate: Date;
  daysActive: number;
}

interface TimeValue {
  time: string;
  timeAsSeconds: number;
  value: number;
}

interface NSProfileSettings {
  dia: number;
  carbratio: TimeValue[];
  sens: TimeValue[];
  basal: TimeValue[];
  target_low: TimeValue[];
  target_high: TimeValue[];
  units: string;
  timezone: string;
}

// Output interfaces - updated ISFProfile to match your needs
interface BasalEntry {
  start: string;
  minutes: number;
  rate: number;
}

interface Sensitivity {
  i: number;
  start: string;
  sensitivity: number;
  offset: number;
  x: number;
  endOffset: number;
}

interface ISFProfile {
  sensitivities: Sensitivity[];
}

interface ATProfileSettings {
  min_5m_carbimpact: number;
  dia: number;
  basalprofile: BasalEntry[];
  isfProfile: ISFProfile;
  carb_ratio: number;
  autosens_max: number;
  autosens_min: number;
}

function convertToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export function transformNightscoutProfileToAutotune(input: NSProfileSettings): ATProfileSettings {
  // Calculate average for carbs only
  const averageCarbs = averageTimeValues(input.carbratio);

  // Transform basal entries
  const basalprofile: BasalEntry[] = input.basal.map((entry) => ({
    start: entry.time + ':00',
    minutes: convertToMinutes(entry.time),
    rate: entry.value,
  }));

  // Transform sensitivities
  const sensitivities: Sensitivity[] = input.sens.map((entry, index) => {
    const nextEntry = input.sens[index + 1];
    return {
      i: index,
      start: entry.time + ':00',
      sensitivity: entry.value,
      offset: convertToMinutes(entry.time),
      x: 0,
      // If this is the last entry, endOffset is 1440 (24 hours), otherwise it's the next entry's offset
      endOffset: nextEntry ? convertToMinutes(nextEntry.time) : 1440,
    };
  });

  const isfProfile: ISFProfile = {
    sensitivities,
  };

  return {
    min_5m_carbimpact: 8.0,
    dia: input.dia,
    basalprofile,
    isfProfile,
    carb_ratio: averageCarbs,
    autosens_max: 1.2,
    autosens_min: 0.7,
  };
}

// profileAnalyzer.ts
export function findMostActiveProfile(profiles: NightscoutProfile[]): {
  profile: NightscoutProfile;
  daysActive: number;
  activeSettings: NSProfileSettings;
} {
  // Sort profiles by startDate for proper sequencing
  const sortedProfiles = profiles.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // Get current date and date 10 days ago
  const now = new Date();
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(now.getDate() - 10);

  // Map the entries with their date ranges
  const dateRanges: DateRange[] = sortedProfiles.map((entry, index) => {
    const startDate = new Date(entry.startDate);
    // Find the end date (which is the start date of the next profile, or current date if it's the latest)
    const nextEntry = sortedProfiles[index + 1];
    const endDate = nextEntry ? new Date(nextEntry.startDate) : now;

    // Calculate days active in the last 10 days
    const daysActive = Math.max(
      0, // Ensure we don't count negative days
      Math.min(
        Math.ceil((endDate.getTime() - Math.max(startDate.getTime(), tenDaysAgo.getTime())) / (1000 * 60 * 60 * 24)),
        Math.ceil((now.getTime() - tenDaysAgo.getTime()) / (1000 * 60 * 60 * 24)),
      ),
    );

    return {
      profile: entry,
      startDate,
      endDate,
      daysActive,
    };
  });

  // Find the profile with the most active days
  // In case of equal days, take the more recent one
  const mostActive = dateRanges.reduce((prev, current) => {
    if (current.daysActive > prev.daysActive) {
      return current;
    } else if (current.daysActive === prev.daysActive) {
      // In case of tie, take the one with the more recent start date
      return current.startDate > prev.startDate ? current : prev;
    }
    return prev;
  });

  // Get the actual profile settings using the default profile name
  const activeSettings = mostActive.profile.store[mostActive.profile.defaultProfile];

  return {
    profile: mostActive.profile,
    daysActive: mostActive.daysActive,
    activeSettings,
  };
}

function averageTimeValues(timeValues: TimeValue[]): number {
  if (!timeValues.length) return 0;
  const sum = timeValues.reduce((acc, curr) => acc + curr.value, 0);
  return sum / timeValues.length;
}
