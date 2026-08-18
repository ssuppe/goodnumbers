import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import yaml from 'js-yaml';

interface ComposeService {
  networks?: Record<string, { aliases?: string[] }>;
  ports?: string[];
}

interface ComposeConfig {
  services?: Record<string, ComposeService>;
}

describe('Caddy Decoupling Infrastructure Contract', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const dockerComposePath = path.join(rootDir, 'docker-compose.yml');
  const dockerComposeProdPath = path.join(rootDir, 'docker-compose.prod.yml');

  it('should not contain caddy or chess services in goodnumbers base docker-compose.yml', async () => {
    const content = await fs.readFile(dockerComposePath, 'utf-8');
    const compose = yaml.load(content) as ComposeConfig;

    expect(compose.services).not.toHaveProperty('caddy');
    expect(compose.services).not.toHaveProperty('chess');
  });

  it('should define network aliases goodnumbers-backend and goodnumbers-frontend for caddy-proxy', async () => {
    const content = await fs.readFile(dockerComposePath, 'utf-8');
    const compose = yaml.load(content) as ComposeConfig;

    // Backend network aliases
    const backendNetworks = compose.services?.backend?.networks;
    expect(backendNetworks).toHaveProperty('caddy-proxy');
    expect(backendNetworks?.['caddy-proxy']?.aliases).toContain(
      'goodnumbers-backend',
    );

    // Frontend network aliases
    const frontendNetworks = compose.services?.frontend?.networks;
    expect(frontendNetworks).toHaveProperty('caddy-proxy');
    expect(frontendNetworks?.['caddy-proxy']?.aliases).toContain(
      'goodnumbers-frontend',
    );
  });

  it('should not bind host ports 80/443 in goodnumbers docker-compose.prod.yml', async () => {
    const content = await fs.readFile(dockerComposeProdPath, 'utf-8');
    const compose = yaml.load(content) as ComposeConfig;

    expect(compose.services).not.toHaveProperty('caddy');
  });

  it('should enforce complete repository hygiene (no Caddyfile or personal infra scripts)', async () => {
    const caddyfilePath = path.join(rootDir, 'Caddyfile');
    const infraScriptsPath = path.join(rootDir, 'scripts/infra');

    const caddyfileExists = await fs
      .access(caddyfilePath)
      .then(() => true)
      .catch(() => false);
    const infraScriptsExist = await fs
      .access(infraScriptsPath)
      .then(() => true)
      .catch(() => false);

    expect(
      caddyfileExists,
      'Caddyfile should be purged from goodnumbers-clean root',
    ).toBe(false);
    expect(
      infraScriptsExist,
      'scripts/infra should be purged from goodnumbers-clean',
    ).toBe(false);
  });
});
