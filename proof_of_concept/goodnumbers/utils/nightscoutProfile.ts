import _ from 'lodash';
import {
  ATProfileSettings,
  BasalEntry,
  DateRange,
  ISFProfile,
  NightscoutProfile,
  NSProfileSettings,
  Sensitivity,
  TimeValue,
} from '@/types/nightscout';

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
export function _findMostActiveProfile(profiles: NightscoutProfile[]): {
  profile: NightscoutProfile;
  daysActive: number;
  activeProfileSettings: NSProfileSettings;
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
    activeProfileSettings: activeSettings,
  };
}

export function getBestProfile(profiles: NightscoutProfile[]): ATProfileSettings[] | null {
  const { profile, daysActive, activeProfileSettings } = _findMostActiveProfile(profiles);
  const activeATProfileSettings: ATProfileSettings = transformNightscoutProfileToAutotune(activeProfileSettings);
  // Simple assignment of activeSettings to both variables, to allow the regular
  // autotune code to work without modifications
  const profile_data: ATProfileSettings = _.cloneDeep(activeATProfileSettings);
  const pumpprofile_data: ATProfileSettings = _.cloneDeep(activeATProfileSettings);

  // disallow impossibly low carbRatios due to bad decoding
  // GN: Goodnumbers version of this only looks at
  if (typeof profile_data.carb_ratio === 'undefined' || profile_data.carb_ratio < 2) {
    if (typeof pumpprofile_data.carb_ratio === 'undefined' || pumpprofile_data.carb_ratio < 2) {
      console.log(
        '{ "carbs": 0, "mealCOB": 0, "reason": "carb_ratios ' +
          profile_data.carb_ratio +
          ' and ' +
          pumpprofile_data.carb_ratio +
          ' out of bounds" }',
      );
      console.error(
        'Error: carb_ratios ' + profile_data.carb_ratio + ' and ' + pumpprofile_data.carb_ratio + ' out of bounds',
      );
      return null;
    } else {
      profile_data.carb_ratio = pumpprofile_data.carb_ratio;
    }
  }
  return [profile_data, pumpprofile_data];
}

function averageTimeValues(timeValues: TimeValue[]): number {
  if (!timeValues.length) return 0;
  const sum = timeValues.reduce((acc, curr) => acc + curr.value, 0);
  return sum / timeValues.length;
}
