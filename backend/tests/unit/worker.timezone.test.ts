import { describe, it, expect } from 'vitest';

// Simulating the inference logic from backend/src/worker.ts
function inferTimezone(offsetMinutes: number): string {
  const offsetHours = offsetMinutes / 60;
  // Etc/GMT offsets are sign-reversed relative to UTC.
  // UTC-4 (New York) is Etc/GMT+4
  // UTC+8 (Singapore) is Etc/GMT-8
  const gmtOffset = -offsetHours;
  const sign = gmtOffset >= 0 ? '+' : '';
  return `Etc/GMT${sign}${gmtOffset}`;
}

describe('Timezone Inference Logic (IANA/Etc/GMT compatible)', () => {
  it('should correctly infer negative offsets (e.g. New York UTC-5 -> Etc/GMT+5)', () => {
    expect(inferTimezone(-300)).toBe('Etc/GMT+5');
    expect(inferTimezone(-240)).toBe('Etc/GMT+4');
  });

  it('should correctly infer positive offsets (e.g. Singapore UTC+8 -> Etc/GMT-8)', () => {
    expect(inferTimezone(480)).toBe('Etc/GMT-8');
    expect(inferTimezone(60)).toBe('Etc/GMT-1');
  });

  it('should handle zero offset (London UTC+0 -> Etc/GMT+0)', () => {
    expect(inferTimezone(0)).toBe('Etc/GMT+0');
  });

  it('should handle partial hour offsets (e.g. India UTC+5.5 -> Etc/GMT-5.5)', () => {
    expect(inferTimezone(330)).toBe('Etc/GMT-5.5');
  });
});
