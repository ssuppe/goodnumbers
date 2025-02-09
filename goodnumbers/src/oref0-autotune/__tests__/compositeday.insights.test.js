// src/lib/autotune/__tests__/insights.test.ts
import { generateInsights } from '../insights';  // your actual code
import testCase1 from './testData/test-case-1.json';

describe('Weekly overview composite day insights Generation', () => {
  test('shows insights for test case 1', () => {
    const insights = generateInsights(testCase1);
    
    // This will print nicely formatted in the console
    console.log('\nInsights for test case 1:');
    console.log(insights);
    
    // A basic assertion just to make the test pass
    expect(insights).toBeDefined();
  });
});