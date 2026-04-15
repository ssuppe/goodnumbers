import { NightscoutClient } from './client.js';
import axios from 'axios';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('axios');
const mockedAxios = axios as any;

describe('NightscoutClient', () => {
  let client: NightscoutClient;
  const baseUrl = 'https://my-nightscout.herokuapp.com';
  const token = 'my-token';

  beforeEach(() => {
    client = new NightscoutClient(baseUrl, token);
    vi.clearAllMocks();
  });

  describe('fetchTreatments', () => {
    it('should fetch treatments within exact date range', async () => {
      const startDate = new Date('2025-01-01T00:00:00Z');
      const endDate = new Date('2025-01-07T00:00:00Z');
      
      mockedAxios.get.mockResolvedValue({ data: [] });

      // @ts-ignore - We are testing the new signature before implementation
      await client.fetchTreatments(startDate, endDate);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/treatments.json`,
        expect.objectContaining({
          params: expect.objectContaining({
            'find[created_at][$gte]': startDate.toISOString(),
            'find[created_at][$lte]': endDate.toISOString(),
          }),
        })
      );
    });
  });
});