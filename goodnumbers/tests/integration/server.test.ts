import request from 'supertest';
import app from '../../src/index';
import * as http from 'http';

// We need a way to close the server after tests are done
let server: http.Server;

beforeAll((done) => {
  // Let's use a random port for testing to avoid conflicts
  server = app.listen(0, () => {
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

describe('GET /health', () => {
  it('should return 200 OK with a status message', async () => {
    const response = await request(server).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
