import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

export async function getSecret(secretName: string): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();

  if (!payload) {
    throw new Error(`Secret ${secretName} not found`);
  }

  return payload;
}

// Initialize secrets at startup
export async function initializeSecrets() {
  if (process.env.NODE_ENV === 'production') {
    process.env.GEMINI_API_KEY = await getSecret('gemini-api-key');
    // Add other secrets as needed
  }
}
