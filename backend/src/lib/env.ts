import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Set NODE_ENV to 'development' if it's not already set by the execution environment.
// This is a safe default for local development scripts like `nodemon`.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const NODE_ENV = process.env.NODE_ENV;

// Define the path for the environment-specific .env file (e.g., .env.development)
const specificEnvPath = path.resolve(process.cwd(), `.env.${NODE_ENV}`);

// We load the environment-specific file first and use `override` to ensure
// its variables take precedence over any system-level variables or
// variables from a base .env file.
if (fs.existsSync(specificEnvPath)) {
  console.log(`[env] Loading environment variables from ${specificEnvPath}`);
  dotenv.config({ path: specificEnvPath, override: true });
} else {
  console.log(
    `[env] No specific environment file found at ${specificEnvPath}. Using system variables.`,
  );
}
