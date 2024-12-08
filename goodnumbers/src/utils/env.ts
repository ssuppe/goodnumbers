// Env variable utils
const getEnvironmentVariable = (environmentVariable: string): string => {
  const unvalidatedEnvironmentVariable = process.env[environmentVariable];
  if (!unvalidatedEnvironmentVariable) {
    throw new Error(`Couldn't find environment variable: ${environmentVariable}`);
  } else {
    return unvalidatedEnvironmentVariable;
  }
};

export const config = {
  backendUrl: getEnvironmentVariable('NEXT_PUBLIC_BACKEND_URL'),
  // Add other environment variables here
} as const;

// Make sure we're not missing any environment variables during build time
export type Config = typeof config;
