import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import crypto from 'crypto';
import { NightscoutClient } from '../../src/lib/nightscout/client.js';

// Define a mock factory for axios to handle isAxiosError correctly without casting
vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn(),
      // Simple implementation: check for a property we set on our mock errors
      isAxiosError: vi.fn((payload) => !!payload?.isAxiosError),
    },
  };
});

describe('NightscoutClient', () => {
  const validUrl = 'https://my-nightscout.herokuapp.com';
  const token = 'my-secret-token';
  const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor & SSRF Validation', () => {
    it('should accept a valid HTTPS URL', () => {
      expect(() => new NightscoutClient(validUrl, token)).not.toThrow();
    });

    it('should reject non-HTTP/HTTPS protocols', () => {
      expect(() => new NightscoutClient('ftp://example.com', token)).toThrow(
        /Invalid protocol/,
      );
    });

    it('should reject localhost', () => {
      expect(
        () => new NightscoutClient('http://localhost:1337', token),
      ).toThrow(/Invalid hostname/);
    });

    it('should reject 127.0.0.1', () => {
      expect(() => new NightscoutClient('http://127.0.0.1', token)).toThrow(
        /Invalid hostname/,
      );
    });

    it('should reject private IP ranges (192.168.x.x)', () => {
      expect(() => new NightscoutClient('http://192.168.1.1', token)).toThrow(
        /Invalid hostname/,
      );
    });

    it('should reject private IP ranges (10.x.x.x)', () => {
      expect(() => new NightscoutClient('http://10.0.0.1', token)).toThrow(
        /Invalid hostname/,
      );
    });
  });

  describe('Authentication Headers', () => {
    it('should use API-SECRET header with SHA1 hash for simple tokens', async () => {
      const client = new NightscoutClient(validUrl, token);
      vi.mocked(axios.get).mockResolvedValue({ data: [] });

      await client.fetchProfile();

      const expectedHash = crypto
        .createHash('sha1')
        .update(token)
        .digest('hex');
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/profile'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'API-SECRET': expectedHash,
          }),
        }),
      );
    });

    it('should use Authorization: Bearer header for JWT tokens', async () => {
      const client = new NightscoutClient(validUrl, jwtToken);
      vi.mocked(axios.get).mockResolvedValue({ data: [] });

      await client.fetchProfile();

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/profile'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${jwtToken}`,
          }),
        }),
      );
    });
  });

  describe('Data Fetching', () => {
    let client: NightscoutClient;

    beforeEach(() => {
      client = new NightscoutClient(validUrl, token);
    });

    it("fetchEntries should call correct endpoint with numeric timestamp query params", async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: [] });
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const to = new Date();
      await client.fetchEntries(from, to);

      const expectedUrl = `${validUrl}/api/v1/entries/sgv.json`;
      // Check the first argument (URL)
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining(expectedUrl),
        expect.anything(),
      );

      // Check the second argument (config object) for params
      const callArgs = vi.mocked(axios.get).mock.calls[0];
      const config = callArgs[1];

      expect(config?.params).toBeDefined();
      expect(config?.params["count"]).toBe(50000);

      const timestampGte = config?.params["find[date][$gte]"];
      const timestampLte = config?.params["find[date][$lte]"];
      expect(timestampGte).toBeDefined();
      expect(timestampLte).toBeDefined();
      expect(typeof timestampGte).toBe("number");
      expect(timestampGte).toBe(from.getTime());
    });

    it('fetchTreatments should call correct endpoint with ISO string query params', async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: [] });
      const from = new Date('2025-01-01T00:00:00.000Z');
      const to = new Date('2025-01-08T00:00:00.000Z');
      await client.fetchTreatments(from, to);

      const expectedUrl = `${validUrl}/api/v1/treatments.json`;
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining(expectedUrl),
        expect.anything(),
      );

      const callArgs = vi.mocked(axios.get).mock.calls[0];
      const config = callArgs[1];

      expect(config?.params).toBeDefined();
      expect(config?.params['count']).toBe(10000);
      expect(config?.params['find[created_at][$gte]']).toBeDefined();
    });

    it("should filter returned data based on date", async () => {
      const now = Date.now();
      const from = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const to = new Date(now);

      const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
      const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000;

      const mockData = [
        { date: eightDaysAgo, sgv: 100 }, // Should be filtered out
        { date: sixDaysAgo, sgv: 120 }, // Should be kept
      ];

      vi.mocked(axios.get).mockResolvedValue({ data: mockData });

      const result = await client.fetchEntries(from, to);
      expect(result).toHaveLength(1);
      expect(result[0].sgv).toBe(120);
    });
  });

  describe('Error Handling', () => {
    it('should throw a typed error on 401 Unauthorized', async () => {
      const client = new NightscoutClient(validUrl, token);

      // Create an object that satisfies the shape expected by the mock and implementation
      // We use Object.assign to add properties to the Error object without 'as any'
      const error = Object.assign(
        new Error('Request failed with status code 401'),
        {
          isAxiosError: true,
          response: { status: 401 },
        },
      );

      vi.mocked(axios.get).mockRejectedValue(error);

      await expect(client.fetchProfile()).rejects.toThrow(
        'Nightscout authentication failed',
      );
    });
  });
});
