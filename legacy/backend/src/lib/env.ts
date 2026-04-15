import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Set NODE_ENV to 'development' if it's not already set by the execution environment.
// This is a safe default for local development scripts like `nodemon`.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const NODE_ENV = process.env.NODE_ENV;

// Define potential paths for the environment-specific .env file
// We check the current directory (standard) and the parent directory (monorepo root)
const localEnvPath = path.resolve(process.cwd(), `.env.${NODE_ENV}`);
const rootEnvPath = path.resolve(process.cwd(), '..', `.env.${NODE_ENV}`);

let envPathToLoad = null;

if (fs.existsSync(localEnvPath)) {
  envPathToLoad = localEnvPath;
} else if (fs.existsSync(rootEnvPath)) {
  envPathToLoad = rootEnvPath;
}

if (envPathToLoad) {
  console.log(`[env] Loading environment variables from ${envPathToLoad}`);
  dotenv.config({ path: envPathToLoad, override: true });
} else {
  console.log(
    `[env] No specific environment file found at ${localEnvPath} or ${rootEnvPath}. Using system variables.`,
  );
}
