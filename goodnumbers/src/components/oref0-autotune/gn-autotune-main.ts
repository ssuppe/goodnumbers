/*

  Good numbers version of autotune - pull and pass data to autotune 
  correctly

  Collects and divides up glucose data for periods dominated by carb absorption,
  correction insulin, or basal insulin, and adds in avgDelta and deviations,
  for use in oref0 autotuning algorithm

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
} from '../widgets/nightscoutProfile';
import { fetchNightscoutData, NightscoutEntry, NightscoutTreatment } from '../widgets/nightscoutActions';
import { gn_autotune_prep } from './gn-autotune-prep';
import { gn_autotune_core } from './gn-autotune-core';
import { compareProfiles } from './gn-autotune-recommends-report';

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
// Get NS Data for last 7 days, then will iterate day by day just like
// Autotune
fetchNightscoutData(nsconfig, 7).then((nsData) => {
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
  //   console.log(generateProfileComparison(profile_data));
});
