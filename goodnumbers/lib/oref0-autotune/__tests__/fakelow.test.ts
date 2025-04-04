// src/lib/autotune/__tests__/autotune.test.ts
import { readLocalFile } from '../../../app/actions/fileCache';
import { ATProfileSettings, getBestProfile } from '../../components/widgets/nightscoutProfile';
import { AutotunePreppedData, gn_autotune_prep } from '../gn-autotune-prep';
import { AnalysisResult, analyzeTimeOfDay, FullAnalysisResult } from '../gn-meal-analysis';
import { NightscoutEntry, NightscoutProfile, NightscoutTreatment } from '../../types/nightscout';
import { getPatientsRange, PatientRange } from '../gn-overview';
import { analyzeMorningRises } from '../gn-dawn-phenom/gn-dawn-phenom-analysis';
import { getDawnPhenomenonNotes } from '../gn-dawn-phenom/gn-dawn-phenom';

describe('Fake Dawn Phenomenon', () => {
  describe('Fake Dawn Phenom', () => {
    let entries: NightscoutEntry[] | null;
    let treatments: NightscoutTreatment[] | null;
    let profiles: NightscoutProfile[] | null;
    let at_profileData: ATProfileSettings[] | null;

    // Use beforeAll to set up the test data once before all tests
    beforeAll(async () => {
      entries = await readLocalFile<NightscoutEntry[]>({
        filename: 'src/oref0-autotune/testdata/low_to_high_dawnphenom.fake.entries.json',
        plainText: false,
      });

      treatments = await readLocalFile<NightscoutTreatment[]>({
        filename: 'src/oref0-autotune/testdata/low_to_high_dawnphenom.fake.treatments.json',
        plainText: false,
      });

      profiles = await readLocalFile<NightscoutProfile[]>({
        filename: 'src/oref0-autotune/testdata/testprofile.json',
        plainText: false,
      });
    });

    test('test overall day average', () => {
      if (profiles && treatments && entries) {
        at_profileData = getBestProfile(profiles);

        const profile_data: ATProfileSettings = at_profileData![0];
        const pumpprofile_data: ATProfileSettings = at_profileData![1];

        const all_prepped_glucose: AutotunePreppedData = gn_autotune_prep(
          entries,
          treatments,
          profile_data,
          pumpprofile_data,
        );

        const full_analysis: FullAnalysisResult = analyzeTimeOfDay(all_prepped_glucose);
        const patient_range: PatientRange = getPatientsRange(full_analysis.overall);

        const morningRiseAnalysis = analyzeMorningRises(all_prepped_glucose, patient_range);

        var notes = getDawnPhenomenonNotes(morningRiseAnalysis, 7, 'mmol/l');

        console.log('exit');

        // const full_analysis: FullAnalysisResult = analyzeTimeOfDay(all_prepped_glucose);
        // const overall: AnalysisResult = full_analysis.overall;
        // console.log(`Average glucose: ${overall.avgGlucose}`);
        // expect(overall.avgGlucose).toEqual(60);
      }
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
