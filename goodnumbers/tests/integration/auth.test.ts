import session from 'supertest-session';
import { createApp } from '../../src/index.ts';
import * as http from 'http';
import type { Express } from 'express';

let server: http.Server;
let app: Express;
let agent: session.Session;

beforeEach((done) => {
  app = createApp();
  server = app.listen(0, () => {
    agent = session(app);
    done();
  });
});

afterEach((done) => {
  server.close(done);
});

describe('API Contract: Auth.js Endpoints', () => {
  describe('CSRF Protection', () => {
    it('POST /api/auth/signout should be rejected without a CSRF token', async () => {
      // No need to fetch csrfToken here, as we are intentionally omitting it.
      // const csrfRes = await agent.get('/api/csrf-token');
      // const csrfToken = csrfRes.body.csrfToken;

      // Now, make the signout request but intentionally omit the token.
      const response = await agent.post('/api/auth/signout').send({});

      // The correct behavior from Auth.js is to reject and redirect.
      expect(response.status).toBe(302);
      const redirectUrl = new URL(
        response.headers['location'],
        'http://127.0.0.1',
      );
      expect(redirectUrl.pathname).toBe('/api/auth/signin');
    });
  });
});
