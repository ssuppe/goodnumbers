import { describe, it, expect } from 'vitest';

// Simulating the logic from backend/src/routes/user.ts
function getTokenHint(token: string | null): string | null {
  if (token === null) return null;
  return token.slice(-3);
}

describe('Token Hinting Utility Logic', () => {
  it('should extract the last 3 characters of a standard token', () => {
    expect(getTokenHint('my-secret-token-12345')).toBe('345');
  });

  it('should handle short tokens correctly', () => {
    expect(getTokenHint('AB')).toBe('AB');
    expect(getTokenHint('A')).toBe('A');
  });

  it('should return an empty string for empty tokens', () => {
    expect(getTokenHint('')).toBe('');
  });

  it('should return null for null input', () => {
    expect(getTokenHint(null)).toBeNull();
  });
});
