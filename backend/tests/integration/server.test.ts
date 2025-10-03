import request from 'supertest';
import { createApp } from '../../src/index.ts'; // Import the factory
import * as http from 'http';
import type { Express } from 'express';

let server: http.Server;
let app: Express; // To hold the app instance

beforeEach((done) => {
  app = createApp(); // Create a new app instance for each test
  server = app.listen(0, done);
});

afterEach((done) => {
  server.close(done);
});

describe('GET /health', () => {
  it('should return 200 OK with a status message', async () => {
    const response = await request(server).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
