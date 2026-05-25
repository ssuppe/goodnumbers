import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/**
 * Standard Environment Loader
 * Precedence:
 * 1. Existing process.env (Docker/System) - HIGHEST
 * 2. .env file (Local secrets)
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

const envFiles = [
  path.join(rootDir, `.env.${NODE_ENV}`),
  path.join(rootDir, '.env'),
];

envFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    if (process.env.DEBUG_ENV || NODE_ENV === 'production') {
      console.log(`[env] Loading defaults from: ${file}`);
    }
    // Set override to FALSE so existing system variables (Docker/PM2) win
    dotenv.config({ path: file, override: false });
  }
});

// CRITICAL: Ensure NODE_ENV stays consistent
if (ORIGINAL_NODE_ENV === 'test') {
  process.env.NODE_ENV = 'test';
}

if (process.env.DEBUG_ENV) {
  console.log(`[env] Environment ready. NODE_ENV: ${process.env.NODE_ENV}`);
}
