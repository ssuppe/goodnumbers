import { describe, it, expect, beforeEach, afterEach } from "vitest";
import session from "supertest-session";
import { createApp } from "@src/index";
import * as http from "http";
import type { Express } from "express";

describe('API Contract: Auth.js Endpoints', () => {
  let app: Express;
  let server: http.Server;
  let agent: session.Session;

  beforeEach(async () => {
    app = createApp();
    await new Promise<void>((resolve) => (server = app.listen(0, resolve)));
    agent = session(app);
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
  });

  describe('CSRF Protection', () => {
    it('POST /api/auth/signout should be rejected without a CSRF token', async () => {
      const response = await agent.post('/api/auth/signout').send({});

      expect(response.status).toBe(302);
      const redirectUrl = new URL(
        response.headers['location'],
        'http://127.0.0.1',
      );
      expect(redirectUrl.pathname).toBe('/api/auth/signin');
    });
  });
});