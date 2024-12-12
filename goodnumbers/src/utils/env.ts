// env.ts
const getEnvironmentVariable = (environmentVariable: string): string => {
  const unvalidatedEnvironmentVariable = process.env[environmentVariable];
  if (!unvalidatedEnvironmentVariable) {
    throw new Error(
      `Couldn't find environment variable: ${environmentVariable}\n` +
        `Make sure it's defined in your .env.development file and starts with NEXT_PUBLIC_ if used in client code.`,
    );
  }
  return unvalidatedEnvironmentVariable;
};

export const config = {
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || '',
  // Add other environment variables here
} as const;

export type Config = typeof config;
