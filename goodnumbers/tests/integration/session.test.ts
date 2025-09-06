import request from "supertest";
import * as http from "http";
import { jest } from "@jest/globals";
import type { Express } from "express";

// 1. Mock the module
jest.unstable_mockModule("@auth/express", () => ({
  getSession: jest.fn(),
  // Add ExpressAuth to the mock
  ExpressAuth: jest.fn(() => (req: any, res: any, next: any) => next()), // Mock it as a simple middleware
}));

// 2. Dynamically import the mocked function and the app factory
const { getSession } = await import("@auth/express");
const { createApp } = await import("../../src/index.js");

// 3. Type assertions for clarity
const mockedGetSession = getSession as jest.Mock;
let app: Express;
let server: http.Server;

beforeAll((done) => {
  // 4. Create the app instance *after* mocks are in place
  app = createApp();
  server = app.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  mockedGetSession.mockClear();
});

describe("GET /api/session", () => {
  it("should return null when the user is not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const response = await request(server).get("/api/session");

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
  });

  it("should return the session object when the user is authenticated", async () => {
    const mockSession = {
      user: {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
      },
      expires: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
    mockedGetSession.mockResolvedValue(mockSession);

    const response = await request(server).get("/api/session");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockSession);
  });
});