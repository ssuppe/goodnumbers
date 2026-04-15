import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import * as http from 'http';
import type { Express, Request, Response, NextFunction } from 'express';

// 1. Mock the module
const mockGetSession = vi.fn();
const mockExpressAuth = vi.fn(() => (req: Request, res: Response, next: NextFunction) => next());

vi.mock('@auth/express', () => ({
  getSession: mockGetSession,
  ExpressAuth: mockExpressAuth,
}));

// Dynamically import the app factory
let createApp: () => Express;
let app: Express;
let server: http.Server;

describe('GET /api/session', () => {
  beforeEach(async () => {
    vi.resetModules(); // Ensure fresh import of createApp
    ({ createApp } = await import('@src/index.ts')); // Dynamically import createApp
    app = createApp();
    await new Promise<void>((resolve) => (server = app.listen(0, resolve)));
    mockGetSession.mockClear(); // Clear mock history
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
  });

  it('should return null when the user is not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await request(server).get('/api/session');

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
  });

  it('should return the session object when the user is authenticated', async () => {
    const mockSession = {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      },
      expires: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
    mockGetSession.mockResolvedValue(mockSession);

    const response = await request(server).get('/api/session');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockSession);
  });
});