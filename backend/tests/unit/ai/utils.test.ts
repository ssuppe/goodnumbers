import { describe, it, expect } from 'vitest';
import { formatInfluencingFactors } from '../../../src/lib/ai/utils';

describe('formatInfluencingFactors', () => {
  it('formats a list of factor values into human-readable labels', () => {
    const factors = [
      'Diet:FatProtein',
      'Emotional:StressAcute',
      'Logistics:Travel',
    ];
    const result = formatInfluencingFactors(factors);
    expect(result).toBe(
      'Heavy or Fatty Meal, Major Stressful Event, Traveling or Time Zone Change',
    );
  });

  it('handles unknown factors gracefully', () => {
    const factors = ['Unknown:Value', 'Diet:FatProtein'];
    const result = formatInfluencingFactors(factors);
    expect(result).toBe('Unknown:Value, Heavy or Fatty Meal');
  });

  it('returns a fallback message if no factors are provided', () => {
    expect(formatInfluencingFactors([])).toBe('None reported');
    expect(formatInfluencingFactors(null)).toBe('None reported');
    expect(formatInfluencingFactors(undefined)).toBe('None reported');
  });
});
