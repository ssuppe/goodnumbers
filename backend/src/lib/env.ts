import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/**
 * Standard Environment Loader
 * Precedence:
 * 1. Existing process.env (Docker/System) - HIGHEST
 * 2. .env file (Local secrets/overrides)
 * 3. .env.[NODE_ENV] (Environment defaults) - LOWEST
 */

const NODE_ENV = process.env.NODE_ENV || 'development';
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

// Support running from root or within backend/
const rootDir =
  fs.existsSync(path.join(process.cwd(), 'package.json')) &&
  !fs.existsSync(path.join(process.cwd(), 'src'))
    ? process.cwd()
    : path.resolve(process.cwd(), '..');

// Load in order of increasing priority (if using override: true)
// OR load in order of decreasing priority (if using override: false)
const envFiles = [
  path.join(rootDir, '.env'), // Local secrets (Highest priority)
  path.join(rootDir, `.env.${NODE_ENV}`), // Env defaults
];

envFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    if (process.env.DEBUG_ENV || NODE_ENV === 'production') {
      console.log(`[env] Loading from: ${file}`);
    }
    // Using override: false means the FIRST file to define a variable wins.
    // So we put .env (secrets) first in the array.
    dotenv.config({ path: file, override: false });
  }
});

// CRITICAL: Ensure NODE_ENV stays consistent
if (ORIGINAL_NODE_ENV === 'test') {
  process.env.NODE_ENV = 'test';
}

if (process.env.DEBUG_ENV) {
  console.log(`[env] Environment ready. NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[env] DB_URL: ${process.env.DATABASE_URL}`);
}
