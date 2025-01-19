import { AxiosResponse } from 'axios';
import { createApiClient } from '../../lib/api/axios';
import {
  NightscoutConfig,
  NightscoutData,
  NightscoutEntry,
  NightscoutProfile,
  NightscoutTreatment,
} from '~/types/nightscout';

export const fetchNightscoutProfiles = async (nsconfig: NightscoutConfig): Promise<NightscoutProfile[]> => {
  const axiosInstance = createApiClient();
  const profilesUrl = `${nsconfig.url}/api/v1/profile?token=${nsconfig.token}`;

  const { data } = await axiosInstance.get<NightscoutProfile[]>(profilesUrl);

  return data;
};

export const fetchNightscoutTreatments = async (
  nsconfig: NightscoutConfig,
  daysToFetch: number = 9,
  treatmentsCount: number = 10000,
): Promise<NightscoutTreatment[]> => {
  const axiosInstance = createApiClient();

  const today = new Date();
  const daysAgo = new Date(today.setDate(today.getDate() - daysToFetch));
  const daysAgoTimestamp = daysAgo.getTime();

  const treatmentsUrl = `${nsconfig.url}/api/v1/treatments.json?token=${nsconfig.token}&find[created_at][$gte]=${daysAgoTimestamp}&count=${treatmentsCount}`;

  try {
    const treatmentsResponse = await axiosInstance.get(treatmentsUrl);

    const treatmentsData = treatmentsResponse.data;
    // .filter(
    //   (item: { date: number; eventType: string; carbs?: number; insulin?: number }) =>
    //     item.date >= daysAgoTimestamp && (item.carbs !== null || item.insulin !== null),
    // )
    // .map((item: NightscoutTreatment) => ({
    //   date: item.date,
    //   carbs: item.carbs,
    //   insulin: item.insulin,
    //   utcOffset: item.utcOffset,
    //   eventType: item.eventType,
    //   created_at: item.created_at,
    // })
    // )
    return treatmentsData;
  } catch (error: any) {
    throw new Error(`Failed to fetch Nightscout data: ${error.message}`);
  }
};

export const fetchNightscoutEntries = async (
  nsconfig: NightscoutConfig,
  daysToFetch: number = 9,
  entriesCount: number = 20000,
): Promise<NightscoutEntry[]> => {
  const axiosInstance = createApiClient();

  const today = new Date();
  const daysAgo = new Date(today.setDate(today.getDate() - daysToFetch));
  const daysAgoTimestamp = daysAgo.getTime();

  const entriesUrl = `${nsconfig.url}/api/v1/entries/sgv.json?token=${nsconfig.token}&find[date][$gte]=${daysAgoTimestamp}&count=${entriesCount}`;

  try {
    const entriesResponse = await axiosInstance.get(entriesUrl);

    const entriesData: NightscoutEntry[] = entriesResponse.data;
    // .filter((item: { date: number }) => item.date >= daysAgoTimestamp)
    // .map((item: NightscoutEntry) => ({
    //   date: item.date,
    //   created_at: item.date,
    //   sgv: item.sgv,
    //   units: item.units,
    //   utcOffset: item.utcOffset,
    // }));

    return entriesData;
  } catch (error: any) {
    throw new Error(`Failed to fetch Nightscout data: ${error.message}`);
  }
};

export const fetchNightscoutData = async (
  nsconfig: NightscoutConfig,
  daysToFetch: number = 9,
  entriesCount: number = 20000,
  treatmentsCount: number = 10000,
): Promise<NightscoutData> => {
  try {
    const [entriesData, treatmentsData, profilesData] = await Promise.all([
      fetchNightscoutEntries(nsconfig, (daysToFetch = daysToFetch), (entriesCount = entriesCount)),
      fetchNightscoutTreatments(nsconfig, (daysToFetch = daysToFetch), (treatmentsCount = treatmentsCount)),
      fetchNightscoutProfiles(nsconfig),
    ]);

    const nsData: NightscoutData = { entries: entriesData, treatments: treatmentsData, profiles: profilesData };
    return nsData;
  } catch (error: any) {
    throw new Error(`Failed to fetch Nightscout data: ${error.message}`);
  }
};
export { type NightscoutEntry };
