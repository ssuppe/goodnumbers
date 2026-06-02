import axios, { AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import {
  NightscoutEntry,
  NightscoutTreatment,
  NightscoutProfile,
} from './types.js';

export class NightscoutClient {
  private baseUrl: string;
  private token: string;

  constructor(url: string, token: string) {
    this.validateUrl(url);
    // Remove trailing slash if present
    this.baseUrl = url.replace(/\/$/, '');
    this.token = token;
  }

  private validateUrl(url: string): void {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol: must be http or https');
    }

    const hostname = parsedUrl.hostname;

    // Deny list for localhost
    if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
      throw new Error('Invalid hostname: localhost is not allowed');
    }

    // Private IP ranges regex
    // 10.0.0.0 - 10.255.255.255
    // 172.16.0.0 - 172.31.255.255
    // 192.168.0.0 - 192.168.255.255
    const privateIpRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;
    if (privateIpRegex.test(hostname)) {
      throw new Error('Invalid hostname: private IP ranges are not allowed');
    }
  }

  private getAuthHeaders(): Record<string, string> {
    // Heuristic: JWTs typically contain dots (header.payload.signature)
    if (this.token.includes('.')) {
      return { Authorization: `Bearer ${this.token}` };
    } else {
      const shasum = crypto.createHash('sha1');
      shasum.update(this.token);
      return { 'API-SECRET': shasum.digest('hex') };
    }
  }

  private async fetch<T>(
    endpoint: string,
    params: Record<string, string | number> = {},
  ): Promise<T> {
    const config: AxiosRequestConfig = {
      headers: this.getAuthHeaders(),
      params: params,
      timeout: 30000, // 30s timeout
    };

    try {
      const response = await axios.get<T>(`${this.baseUrl}${endpoint}`, config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('Nightscout authentication failed');
      }
      throw error;
    }
  }

  public async fetchEntries(from: Date, to: Date): Promise<NightscoutEntry[]> {
    const fromTime = from.getTime();
    const toTime = to.getTime();

    // Using numeric timestamp for compatibility as per PoC
    const entries = await this.fetch<NightscoutEntry[]>(
      '/api/v1/entries/sgv.json',
      {
        'find[date][$gte]': fromTime,
        'find[date][$lte]': toTime,
        count: 50000, // Increased count for potentially longer custom ranges
      },
    );

    // Client-side filtering to ensure strict adherence to the time window
    return entries.filter((entry) => entry.date >= fromTime && entry.date <= toTime);
  }

  public async fetchTreatments(
    from: Date,
    to: Date,
  ): Promise<NightscoutTreatment[]> {
    let treatments = await this.fetch<NightscoutTreatment[]>(
      '/api/v1/treatments.json',
      {
        'find[created_at][$gte]': from.toISOString(),
        'find[created_at][$lte]': to.toISOString(),
        count: 10000,
      },
    );
    console.log(`Fetched ${treatments.length} treatments from Nightscout`);

    // Client-side filtering
    // Note: Treatments use 'created_at' in the query but the object might have 'date' or 'created_at'
    const fromTime = from.getTime();
    const toTime = to.getTime();

    treatments = treatments.filter((treatment) => {
      // Some nightscout versions use created_at string, some use date number.
      // We'll try to be robust.
      const date = treatment.date || new Date(treatment.created_at).getTime();
      return date >= fromTime && date <= toTime;
    });
    console.log(
      `After filtering, ${treatments.length} treatments remain within the time window`,
    );
    return treatments;
  }

  public async fetchProfile(): Promise<NightscoutProfile[]> {
    return this.fetch<NightscoutProfile[]>('/api/v1/profile');
  }
}
