'use server';
import { createApiClient } from '../../lib/api/axios';
import {
  NightscoutConfig,
  NightscoutData,
  NightscoutEntry,
  NightscoutProfile,
  NightscoutTreatment,
} from '~/types/nightscout';
import { canReadLocal, canWriteLocal, env } from '~/utils/env';

import { readLocalFile, writeLocalFile } from 'app/actions/fileCache';

export const fetchNightscoutProfiles = async (nsconfig: NightscoutConfig): Promise<NightscoutProfile[] | null> => {
  if (canReadLocal()) {
    return readLocalFile<NightscoutProfile[]>({ filename: 'nightscout/profile.json' });
  }

  const axiosInstance = createApiClient();
  const profilesUrl = `${nsconfig.url}/api/v1/profile?token=${nsconfig.token}`;

  const { data } = await axiosInstance.get<NightscoutProfile[]>(profilesUrl);

  if (canWriteLocal()) {
    await writeLocalFile(data, { filename: 'nightscout/profile.json' });
  }

  return data;
};

export const fetchNightscoutTreatments = async (
  nsconfig: NightscoutConfig,
  daysToFetch: number = 9,
  treatmentsCount: number = 10000,
): Promise<NightscoutTreatment[] | null> => {
  if (canReadLocal()) {
    return readLocalFile<NightscoutTreatment[]>({ filename: 'nightscout/treatments.json' });
  }

  const axiosInstance = createApiClient();

  const today = new Date();
  const daysAgo = new Date(today.setDate(today.getDate() - daysToFetch));
  const daysAgoTimestamp = daysAgo.getTime();

  const treatmentsUrl = `${nsconfig.url}/api/v1/treatments.json?token=${nsconfig.token}&find[created_at][$gte]=${daysAgoTimestamp}&count=${treatmentsCount}`;

  try {
    const treatmentsResponse = await axiosInstance.get(treatmentsUrl);

    const treatmentsData = treatmentsResponse.data;

    if (canWriteLocal()) {
      await writeLocalFile(treatmentsData, { filename: 'nightscout/treatments.json' });
    }

    return treatmentsData;
  } catch (error: any) {
    throw new Error(`Failed to fetch Nightscout data: ${error.message}`);
  }
};

export const fetchNightscoutEntries = async (
  nsconfig: NightscoutConfig,
  daysToFetch: number = 9,
  entriesCount: number = 20000,
): Promise<NightscoutEntry[] | null> => {
  // If in development mode and debug is enabled, read from local file
  if (canReadLocal()) {
    return readLocalFile<NightscoutEntry[]>({ filename: 'nightscout/entries.json' });
  }
  const axiosInstance = createApiClient();

  const today = new Date();
  const daysAgo = new Date(today.setDate(today.getDate() - daysToFetch));
  const daysAgoTimestamp = daysAgo.getTime();

  const entriesUrl = `${nsconfig.url}/api/v1/entries/sgv.json?token=${nsconfig.token}&find[date][$gte]=${daysAgoTimestamp}&count=${entriesCount}`;

  try {
    const entriesResponse = await axiosInstance.get(entriesUrl);

    const entriesData: NightscoutEntry[] = entriesResponse.data;

    // If in development mode and writeLocal is enabled, save to local file
    if (canWriteLocal()) {
      await writeLocalFile(entriesData, { filename: 'nightscout/entries.json' });
    }
    return entriesData;
  } catch (error: any) {
    throw new Error(`Failed to fetch Nightscout data: ${error.message}`);
  }
};

export const fetchNightscoutData = async (
  nsconfig: NightscoutConfig,
  daysToFetch: number = 7,
  entriesCount: number = 20000,
  treatmentsCount: number = 10000,
): Promise<NightscoutData> => {
  try {
    const [entriesData, treatmentsData, profilesData]: [
      NightscoutEntry[] | null,
      NightscoutTreatment[] | null,
      NightscoutProfile[] | null,
    ] = await Promise.all([
      fetchNightscoutEntries(nsconfig, daysToFetch, entriesCount),
      fetchNightscoutTreatments(nsconfig, daysToFetch, treatmentsCount),
      fetchNightscoutProfiles(nsconfig),
    ]);

    const nsData: NightscoutData = { entries: entriesData!, treatments: treatmentsData!, profiles: profilesData! };
    return nsData;
  } catch (error: any) {
    throw new Error(`Failed to fetch Nightscout data: ${error.message}`);
  }
};
export { type NightscoutEntry };
