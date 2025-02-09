export const env = {
  isDevelopment: process.env.ENV! === 'development',
  readLocal: process.env.READ_LOCAL! === 'true',
  writeLocal: process.env.WRITE_LOCAL! === 'true',
} as const;

export function canWriteLocal(): boolean {
  return env.isDevelopment && env.writeLocal;
}

export function canReadLocal(): boolean {
  return env.isDevelopment && env.readLocal;
}

let _env = {} as typeof env;

_env = env;
