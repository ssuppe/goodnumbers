// file: goodnumbers-workspace/goodnumbers/tests/integration/server.test.ts

import request from 'supertest';
import app from '../../src/index';
import * as http from 'http';
import { connection as redisConnection } from '../../src/lib/queue';

// We need a way to close the server after tests are done
let server: http.Server;

beforeAll((done) => {
  // Let's use a random port for testing to avoid conflicts
  server = app.listen(0, () => {
    done();
  });
});

// REFACTORED to use async/await and close all connections
afterAll(async () => {
  await redisConnection.quit();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
});

describe('GET /health', () => {
  it('should return 200 OK with a status message', async () => {
    const response = await request(server).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
