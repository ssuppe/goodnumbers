/*
ORIGINAL WORK AND NOT COVERED IN MIT LICENSE
TODO: ADD OFFICIAL TEXT HERE
*/

import dotenv from 'dotenv';
import { findMostActiveProfile, NightscoutProfile } from '../widgets/nightscoutProfile';
import {
  fetchNightscoutEntries,
  fetchNightscoutProfiles,
  fetchNightscoutTreatments,
  NightscoutEntry,
  NightscoutTreatment,
} from '../widgets/nightscoutActions';

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

let entries: NightscoutEntry[];
let treatments: NightscoutTreatment[];
let profiles: NightscoutProfile[];
let mostActiveProfile;
let mostActiveProfileSettings;
fetchNightscoutProfiles(nsconfig).then((profiles) => {
  console.log('Profiles: ', profiles);

  const { profile, daysActive, activeSettings } = findMostActiveProfile(profiles);
  mostActiveProfile = profile;
  mostActiveProfileSettings = activeSettings;
});

fetchNightscoutEntries(nsconfig).then((e) => {
  entries = e;
});

fetchNightscoutTreatments(nsconfig).then((t) => {
  treatments = t;
});

///////////////////////////////////////////////////////////////////////
// Pass to autotune
///////////////////////////////////////////////////////////////////////

// Import the generate function
// const generate = require('./bin/oref0-autotune-prep').default;
// generate();
