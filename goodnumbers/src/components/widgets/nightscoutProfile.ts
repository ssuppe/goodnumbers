// types.ts
export interface ProfileSettings {
  dia: number;
  carbratio: TimeValue[];
  sens: TimeValue[];
  basal: TimeValue[];
  target_low: TimeValue[];
  target_high: TimeValue[];
  units: string;
  timezone: string;
}

interface TimeValue {
  time: string;
  timeAsSeconds: number;
  value: number;
}

export interface NightscoutProfile {
  _id: string;
  defaultProfile: string;
  startDate: string;
  store: Record<string, ProfileSettings>;
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

// profileAnalyzer.ts
export function findMostActiveProfile(profiles: NightscoutProfile[]): {
  profile: NightscoutProfile;
  daysActive: number;
  activeSettings: ProfileSettings;
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

// Example usage in your API route or component:
// import { findMostActiveProfile } from './profileAnalyzer';

// // In your API route or component:
// async function getActiveProfile() {
//   try {
//     const response = await axios.get('/api/profiles', {
//       // Your axios configuration here
//     });

//     const { profile, daysActive, activeSettings } = findMostActiveProfile(response.data);

//     // Now you have access to:
//     // - The full profile object
//     // - The number of days it was active
//     // - The specific settings for the default profile
//     return { profile, daysActive, activeSettings };
//   } catch (error) {
//     console.error('Error fetching profile data:', error);
//     throw error;
//   }
// }
