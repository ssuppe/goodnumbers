import { describe, it, expect } from 'vitest';

// Simulating the inference logic from backend/src/worker.ts
function inferTimezone(offsetMinutes: number): string {
  const offsetHours = offsetMinutes / 60;
  const sign = offsetHours >= 0 ? '+' : '';
  return `UTC${sign}${offsetHours}`;
}

describe('Timezone Inference Logic', () => {
  it('should correctly infer positive offsets', () => {
    expect(inferTimezone(60)).toBe('UTC+1');
    expect(inferTimezone(300)).toBe('UTC+5');
  });

  it('should correctly infer negative offsets', () => {
    expect(inferTimezone(-300)).toBe('UTC-5');
    expect(inferTimezone(-60)).toBe('UTC-1');
  });

  it('should handle zero offset', () => {
    expect(inferTimezone(0)).toBe('UTC+0');
  });

  it('should handle partial hour offsets (e.g. India)', () => {
    // Note: Luxon is quite flexible with UTC strings
    expect(inferTimezone(330)).toBe('UTC+5.5');
  });
});
