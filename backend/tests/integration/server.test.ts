// file: backend/tests/integration/server.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import supertest from "supertest";
import { createApp } from "@src/index";
import * as http from "http";
import type { Express } from "express";

describe("GET /api/health", () => {
  let app: Express;
  let server: http.Server;

  beforeEach(async () => {
    app = createApp();
    await new Promise<void>((resolve) => (server = app.listen(0, resolve)));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
  });

  it("should return 200 OK with a status message", async () => {
    const response = await supertest(server).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});