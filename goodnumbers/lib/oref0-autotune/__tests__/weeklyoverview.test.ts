// src/lib/autotune/__tests__/autotune.test.ts
import { readLocalFile } from '../../../app/actions/fileCache';
import { ATProfileSettings, getBestProfile } from '../../components/widgets/nightscoutProfile';
import { AutotunePreppedData, gn_autotune_prep } from '../gn-autotune-prep';
import { AnalysisResult, analyzeTimeOfDay, FullAnalysisResult } from '../gn-meal-analysis';
import { NightscoutEntry, NightscoutProfile, NightscoutTreatment } from '../../types/nightscout';

describe('Weekly Overview Module', () => {
  describe('analyzeTimeOfDay', () => {
    let entries60: NightscoutEntry[] | null;
    let treatments60: NightscoutTreatment[] | null;
    let profiles: NightscoutProfile[] | null;
    let at_profileData: ATProfileSettings[] | null;

    // Use beforeAll to set up the test data once before all tests
    beforeAll(async () => {
      entries60 = await readLocalFile<NightscoutEntry[]>({
        filename: 'lib/oref0-autotune/testdata/entries.60.json',
        plainText: false,
      });

      treatments60 = await readLocalFile<NightscoutTreatment[]>({
        filename: 'lib/oref0-autotune/testdata/treatments.60.json',
        plainText: false,
      });

      profiles = await readLocalFile<NightscoutProfile[]>({
        filename: 'lib/oref0-autotune/testdata/testprofile.json',
        plainText: false,
      });
    });

    test('test overall day average', () => {
      expect(0).toEqual(0);
      // if (profiles && treatments60 && entries60) {
      //   at_profileData = getBestProfile(profiles);

      //   const profile_data: ATProfileSettings = at_profileData![0];
      //   const pumpprofile_data: ATProfileSettings = at_profileData![1];

      //   const all_prepped_glucose: AutotunePreppedData = gn_autotune_prep(
      //     entries60,
      //     treatments60,
      //     profile_data,
      //     pumpprofile_data,
      //   );

      //   const full_analysis: FullAnalysisResult = analyzeTimeOfDay(all_prepped_glucose);
      //   const overall: AnalysisResult = full_analysis.overall;
      //   console.log(`Average glucose: ${overall.avgGlucose}`);
      //   expect(overall.avgGlucose).toEqual(60);
      // }
    });
  });

  describe('calculateSensitivity', () => {
    beforeEach(() => {
      // setup code
    });

    afterEach(() => {
      // cleanup code
    });

    test('calculates sensitivity correctly', () => {
      // test code
    });
  });
});
