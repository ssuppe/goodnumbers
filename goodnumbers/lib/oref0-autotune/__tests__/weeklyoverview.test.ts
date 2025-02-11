// src/lib/autotune/__tests__/autotune.test.ts

// Import the functions you want to test
import { readLocalFile } from '../../../app/actions/fileCache';
import { ATProfileSettings, getBestProfile } from '~/components/widgets/nightscoutProfile';
import { AutotunePreppedData, gn_autotune_prep } from '~/oref0-autotune/gn-autotune-prep';
import { AnalysisResult, analyzeTimeOfDay, FullAnalysisResult } from '~/oref0-autotune/gn-meal-analysis';
import { NightscoutEntry, NightscoutProfile, NightscoutTreatment } from '~/types/nightscout';

// Top level describe block groups all tests for this module
describe('Weekly Overview Module', () => {
  // Nested describe block for specific function
  describe('analyzeTimeOfDay', () => {
    // You can set up common test data or mocks before tests
    let entries60;
    console.log(`path: ${process.cwd()}`);
    readLocalFile<NightscoutEntry[]>({
      filename: 'lib/oref0-autotune/testdata/entries.60.json',
      plainText: false,
    }).then((data) => {
      entries60 = data;
    });
    console.log(`entries: ${entries60}`);

    let treatments60;
    readLocalFile<NightscoutTreatment[]>({
      filename: '/home/ssuppe/vscode/goodnumbers-workspace/goodnumbers/lib/oref0-autotune/testdata/treatments.60.json',
      plainText: false,
    }).then((data) => {
      treatments60 = data;
    });
    console.log(`treatments: ${treatments60}`);

    let profiles;
    readLocalFile<NightscoutProfile[]>({
      filename: '/home/ssuppe/vscode/goodnumbers-workspace/goodnumbers/lib/oref0-autotune/testdata/testprofile.json',
      plainText: false,
    }).then((data) => {
      profiles = data;
    });
    console.log(`profiles: ${profiles}`);
    let at_profileData: ATProfileSettings[] | null = getBestProfile(profiles!);
    if (profiles != null && treatments60 != null && entries60 != null && at_profileData != null) {
      let profile_data: ATProfileSettings = at_profileData[0];
      let pumpprofile_data: ATProfileSettings = at_profileData[1];
      const all_prepped_glucose: AutotunePreppedData = gn_autotune_prep(
        entries60,
        treatments60,
        profile_data,
        pumpprofile_data,
      );

      const full_analysis: FullAnalysisResult = analyzeTimeOfDay(all_prepped_glucose);
      const overall: AnalysisResult = full_analysis.overall;
      // Individual test case
      test('test overall day average', () => {
        // Jest's expect API for assertions
        expect(overall.avgGlucose).toBeDefined();
        // expect(result.someValue).toBe(expectedValue);
      });

      // // Test error conditions
      // test('throws error for invalid input', () => {
      //   const badData = null;
      //   // Testing that a function throws
      //   expect(() => {
      //     processCarbRatios(badData);
      //   }).toThrow();
      // });

      // // Test edge cases
      // test('handles zero values appropriately', () => {
      //   const zeroData = {
      //     // data with zero values
      //   };
      //   const result = processCarbRatios(zeroData);
      //   expect(result.someCalculation).toBe(expectedValue);
      // });
    }
  });

  // Another describe block for a different function
  describe('calculateSensitivity', () => {
    // You can run setup before each test
    beforeEach(() => {
      // setup code
    });

    // You can run cleanup after each test
    afterEach(() => {
      // cleanup code
    });

    test('calculates sensitivity correctly', () => {
      // test code
    });
  });
});
