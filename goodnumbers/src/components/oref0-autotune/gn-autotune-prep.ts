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

var generate = require('./lib/autotune-prep');
var _ = require('lodash');
var moment = require('moment');

// if (!module.parent) {
//   var argv = require('yargs')
//     .usage(
//       '$0 <pumphistory.json> <profile.json> <glucose.json> <pumpprofile.json> [<carbhistory.json>] [--categorize_uam_as_basal] [--tune-insulin-curve] [--output-file=<output_file.json>]',
//     )
//     .option('categorize_uam_as_basal', {
//       alias: 'u',
//       boolean: true,
//       describe: 'Categorize UAM as basal',
//       default: false,
//     })
//     .option('tune-insulin-curve', {
//       alias: 'i',
//       boolean: true,
//       describe: 'Tune peak time and end time',
//       default: false,
//     })
//     .option('output-file', {
//       alias: 'o',
//       describe: 'Output file to write output',
//       default: null,
//     })
//     .strict(true)
//     .help('help');

//   var params = argv.argv;
//   var inputs = params._;

//   if (inputs.length < 4 || inputs.length > 5) {
//     argv.showHelp();
//     console.log('{ "error": "Insufficient arguments" }');
//     process.exit(1);
//   }

//   var pumphistory_input = inputs[0];
//   var profile_input = inputs[1];
//   var glucose_input = inputs[2];
//   var pumpprofile_input = inputs[3];
//   var carb_input = inputs[4];

//   var fs = require('fs');
//   try {
//     var pumphistory_data = JSON.parse(fs.readFileSync(pumphistory_input, 'utf8'));
//     var profile_data = JSON.parse(fs.readFileSync(profile_input, 'utf8'));
//   } catch (e) {
//     console.log('{ "error": "Could not parse input data" }');
//     return console.error('Could not parse input data: ', e);
//   }
//   var pumpprofile_data = {};
//   if (typeof pumpprofile_input !== 'undefined') {
//     try {
//       pumpprofile_data = JSON.parse(fs.readFileSync(pumpprofile_input, 'utf8'));
//     } catch (e) {
//       console.error('Warning: could not parse ' + pumpprofile_input);
//     }
//   }

import dotenv from 'dotenv';
import {
  findMostActiveProfile,
  NightscoutProfile,
  ProfileSettings,
  transformNightscoutProfileToAutotune,
} from '../widgets/nightscoutProfile';
import { fetchNightscoutData, NightscoutEntry, NightscoutTreatment } from '../widgets/nightscoutActions';

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

let profile_data: ProfileSettings;
let pumpprofile_data: ProfileSettings;

fetchNightscoutData(nsconfig).then((nsData) => {
  const { profile, daysActive, activeSettings } = findMostActiveProfile(nsData.profiles);

  // Simple assignment of activeSettings to both variables, to allow the regular
  // autotune code to work without modifications
  profile_data = activeSettings;
  pumpprofile_data = activeSettings;

  // disallow impossibly low carbRatios due to bad decoding
  // GN: Goodnumbers version of this only looks at
  if (typeof profile_data.carbratio === 'undefined' || profile_data.carbratio < 2) {
    if (typeof pumpprofile_data.carbratio === 'undefined' || pumpprofile_data.carbratio < 2) {
      console.log(
        '{ "carbs": 0, "mealCOB": 0, "reason": "carb_ratios ' +
          profile_data.carbratio +
          ' and ' +
          pumpprofile_data.carbratio +
          ' out of bounds" }',
      );
      return console.error(
        'Error: carb_ratios ' + profile_data.carbratio + ' and ' + pumpprofile_data.carbratio + ' out of bounds',
      );
    } else {
      profile_data.carbratio = pumpprofile_data.carbratio;
    }
  }

  // get insulin curve from pump profile that is maintained
  // GN: Ignoring this as we won't be tuning the insulin curve, and
  // GN: we don't have access to the pump profile anyway
  // profile_data.curve = pumpprofile_data.curve;

  // Pump profile has an up to date copy of useCustomPeakTime from preferences
  // If the preferences file has useCustomPeakTime use the previous autotune dia and PeakTime.
  // Otherwise, use data from pump profile.
  // if (!pumpprofile_data.useCustomPeakTime) {
  //   profile_data.dia = pumpprofile_data.dia;
  //   profile_data.insulinPeakTime = pumpprofile_data.insulinPeakTime;
  // }

  // // Always keep the curve value up to date with what's in the user preferences
  // profile_data.curve = pumpprofile_data.curve;

  // try {
  //   var glucose_data = JSON.parse(fs.readFileSync(glucose_input, 'utf8'));
  // } catch (e) {
  //   return console.error('Warning: could not parse ' + glucose_input, e);
  // }
  let glucose_data = nsData.entries;

  // var carb_data = {};
  // if (typeof carb_input !== 'undefined') {
  //   try {
  //     carb_data = JSON.parse(fs.readFileSync(carb_input, 'utf8'));
  //   } catch (e) {
  //     console.error('Warning: could not parse ' + carb_input);
  //   }
  // }
  let carb_data = nsData.treatments;

  // Have to sort history - NS sort doesn't account for different zulu and local timestamps
  let pumphistory_data = nsData.entries;
  pumphistory_data = _.orderBy(
    pumphistory_data,
    [
      function (o) {
        return moment(o.created_at).valueOf();
      },
    ],
    ['desc'],
  );

  const ATProfile = transformNightscoutProfileToAutotune(profile_data);
  let inputs = {
    history: pumphistory_data,
    profile: ATProfile,
    pumpprofile: pumpprofile_data,
    carbs: carb_data,
    glucose: glucose_data,
    categorize_uam_as_basal: false, // GN: params.categorize_uam_as_basal,
    tune_insulin_curve: false, // params['tune-insulin-curve'],
  };

  var prepped_glucose = generate(inputs);
  // if (params['output-file']) {
  //   fs.writeFileSync(params['output-file'], JSON.stringify(prepped_glucose));
  // } else {
  console.log(JSON.stringify(prepped_glucose));
  // }
});
