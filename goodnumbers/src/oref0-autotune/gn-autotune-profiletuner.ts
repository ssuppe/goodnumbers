/*

  Using autotune

  Original code was released under MIT license. This is listed below, but does
  not apply to Goodnumbers modifications.

  Released under MIT license. See the accompanying LICENSE.txt file for
  full terms and conditions

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.

*/

import dotenv from 'dotenv';
var _ = require('lodash');

import {
  ATProfileSettings,
  findMostActiveProfile,
  transformNightscoutProfileToAutotune,
} from '../components/widgets/nightscoutProfile';
import { fetchNightscoutData, NightscoutEntry, NightscoutTreatment } from '../components/widgets/nightscoutActions';
import { gn_autotune_prep } from './gn-autotune-prep';
import { gn_autotune_core } from './gn-autotune-core';
import { compareProfiles } from './gn-autotune-recommends-report';
import {
  analyzeMealEvents,
  analyzeTimeOfDay,
  // DailyPatternSummary,
  // generatePatternSummary,
  MealEvent,
  TimeRangeAnalysisWithHours,
} from './gn-meal-analysis';
import { GLUCOSE_RANGES } from './gn-constants';
import { checkDawnPhenomenon } from './gn-dawn-phenom/gn-dawn-phenom';

dotenv.config();

interface NSConfig {
  url: string;
  token: string;
}

const getNSConfig = (): NSConfig => {
  const config: NSConfig = {
    url: process.env.NSURL || '',
    token: process.env.NSTOKEN || '',
  };

  if (!config.url || !config.token) {
    throw new Error('NSURL and NSTOKEN environment variables are required');
  }

  return config;
};

const nsconfig = getNSConfig();
console.log('Nightscout Configuration:', nsconfig);

/* INPUT ORDER FROM AUTOTUNE
    var pumphistory_input = inputs[0]; // ns-treatments.$i.json, or treatments
    var profile_input = inputs[1]; // profile
    var glucose_input = inputs[2]; // entries/sgv.json
    var pumpprofile_input = inputs[3]; // just profile again, we don't have access to anything else
    var carb_input = inputs[4]; // 
*/

let profile_data: ATProfileSettings;
let pumpprofile_data: ATProfileSettings;
// Get NS Data for last X days, then will iterate day by day just like
// Autotune
fetchNightscoutData(nsconfig, 3).then((nsData) => {
  //////////////////////////////////////////////////////////////////////////////
  // Sort nsData entries and treatments
  nsData.entries.sort((a, b) => a.date - b.date);
  nsData.treatments.sort((a, b) => a.date - b.date);
  const firstDate = new Date(nsData.entries[0].date).toISOString().split('T')[0];
  const endDate = new Date(nsData.entries[nsData.entries.length - 1].date).toISOString().split('T')[0];
  const numDays = Math.round((new Date(endDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24));

  //////////////////////////////////////////////////////////////////////////////
  // PROFILE: Autotune only uses a single profile over all days, so I will replicate here
  /////////////////////////////////////////////////////////////////////////////

  const { profile, daysActive, activeProfileSettings } = findMostActiveProfile(nsData.profiles);
  const activeATProfileSettings: ATProfileSettings = transformNightscoutProfileToAutotune(activeProfileSettings);
  // Simple assignment of activeSettings to both variables, to allow the regular
  // autotune code to work without modifications
  profile_data = _.cloneDeep(activeATProfileSettings);
  pumpprofile_data = _.cloneDeep(activeATProfileSettings);

  // disallow impossibly low carbRatios due to bad decoding
  // GN: Goodnumbers version of this only looks at
  if (typeof profile_data.carb_ratio === 'undefined' || profile_data.carb_ratio < 2) {
    if (typeof pumpprofile_data.carb_ratio === 'undefined' || pumpprofile_data.carb_ratio < 2) {
      console.log(
        '{ "carbs": 0, "mealCOB": 0, "reason": "carb_ratios ' +
          profile_data.carb_ratio +
          ' and ' +
          pumpprofile_data.carb_ratio +
          ' out of bounds" }',
      );
      return console.error(
        'Error: carb_ratios ' + profile_data.carb_ratio + ' and ' + pumpprofile_data.carb_ratio + ' out of bounds',
      );
    } else {
      profile_data.carb_ratio = pumpprofile_data.carb_ratio;
    }
  }

  ///////////////////////////////////////////////////////////////////////////
  // Meal analysis
  ///////////////////////////////////////////////////////////////////////////
  const all_prepped_glucose = gn_autotune_prep(nsData.entries, nsData.treatments, profile_data, pumpprofile_data);
  ///////////////////////////////////////////////////////////////////////////
  // Generate tuned profile like autotune
  ///////////////////////////////////////////////////////////////////////////
  // Iterate over days just like autotune
  const entriesByDay = _.groupBy(
    nsData.entries,
    (entry: NightscoutEntry) => new Date(entry.date).toISOString().split('T')[0],
  );
  const treatmentsByDay = _.groupBy(
    nsData.treatments,
    (treatment: NightscoutTreatment) => new Date(treatment.date).toISOString().split('T')[0],
  );
  // Sort days in ascending order
  const sortedDays = Object.keys(entriesByDay).sort();
  for (const day of sortedDays) {
    const dayEntries = entriesByDay[day];
    const dayTreatments = treatmentsByDay[day];

    const day_prepped_glucose = gn_autotune_prep(dayEntries, dayTreatments, profile_data, pumpprofile_data);

    /////////////////////////////////////////////////////////////////////////
    // AUTOTUNE CORE
    /////////////////////////////////////////////////////////////////////////
    profile_data = gn_autotune_core(day_prepped_glucose, profile_data, pumpprofile_data);
  }

  compareProfiles(pumpprofile_data, profile_data);
});
