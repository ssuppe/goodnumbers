import { createApiClient } from '~/lib/api/axios';

interface NightscoutConfig {
  url: string;
  token: string;
  daysToFetch?: number;
  entriesCount?: number;
  treatmentsCount?: number;
}

interface NightscoutEntry {
  date: number;
  sgv: number;
  units: string;
  utcOffset: number;
}

interface NightscoutTreatment {
  date: number;
  carbs?: number;
  insulin?: number;
  utcOffset: number;
  eventType: string;
}

interface NightscoutData {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
}

const fetchNightscoutData = async ({
  url,
  token,
  daysToFetch = 9,
  entriesCount = 20000,
  treatmentsCount = 10000,
}: NightscoutConfig): Promise<NightscoutData> => {
  const axiosInstance = createApiClient();

  const today = new Date();
  const daysAgo = new Date(today.setDate(today.getDate() - daysToFetch));
  const daysAgoTimestamp = daysAgo.getTime();

  const entriesUrl = `${url}/api/v1/entries/sgv.json?token=${token}&find[date][$gte]=${daysAgoTimestamp}&count=${entriesCount}`;
  const treatmentsUrl = `${url}/api/v1/treatments.json?token=${token}&find[created_at][$gte]=${daysAgoTimestamp}&count=${treatmentsCount}`;

  try {
    const [entriesResponse, treatmentsResponse] = await Promise.all([
      axiosInstance.get(entriesUrl),
      axiosInstance.get(treatmentsUrl),
    ]);

    const entriesData = entriesResponse.data
      .filter((item: { date: number }) => item.date >= daysAgoTimestamp)
      .map((item: NightscoutEntry) => ({
        date: item.date,
        sgv: item.sgv,
        units: item.units,
        utcOffset: item.utcOffset,
      }));

    const treatmentsData = treatmentsResponse.data
      .filter(
        (item: { date: number; eventType: string; carbs?: number; insulin?: number }) =>
          item.date >= daysAgoTimestamp && (item.carbs !== null || item.insulin !== null),
      )
      .map((item: NightscoutTreatment) => ({
        date: item.date,
        carbs: item.carbs,
        insulin: item.insulin,
        utcOffset: item.utcOffset,
        eventType: item.eventType,
      }));

    return { entries: entriesData, treatments: treatmentsData };
  } catch (error: any) {
    throw new Error(`Failed to fetch Nightscout data: ${error.message}`);
  }
};

export default fetchNightscoutData;
