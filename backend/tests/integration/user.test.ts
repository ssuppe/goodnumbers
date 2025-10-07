// file: backend/tests/integration/user.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as http from "http";
import type { Express } from "express";
import session from "supertest-session";
import type { User } from "@goodnumbers/types";
import { PrismockClient } from "prismock";
import { prisma as originalPrisma } from "@src/lib/prisma.js";
import { decrypt } from "@src/lib/encryption.ts";

vi.mock("@src/lib/prisma.js", () => ({
  prisma: new PrismockClient(),
}));

const { createApp } = await import("@src/index.js");
const testPrisma = originalPrisma as unknown as PrismockClient;

describe("PUT /api/user/settings", () => {
  let app: Express;
  let server: http.Server;
  let agent: session.Session;
  let testUser: User;
  let csrfToken: string;

  beforeEach(async () => {
    await testPrisma.reset();
    app = createApp();
    await new Promise<void>((resolve) => (server = app.listen(0, resolve)));
    agent = session(app);

    testUser = await testPrisma.user.create({
      data: {
        email: `settings-user-${Date.now()}@test.com`,
        agreementsSigned: true,
      },
    });
    const csrfRes = await agent.get("/api/csrf-token");
    csrfToken = csrfRes.body.csrfToken;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
  });

  it('should return 401 Unauthorized if no user is authenticated', async () => {
    const response = await agent.put('/api/user/settings').send({
      preferredUnits: 'MMOL',
      _csrf: csrfToken,
    });
    expect(response.status).toBe(401);
  });

  it('should return 400 Bad Request for invalid data', async () => {
    const response = await agent
      .put('/api/user/settings')
      .set('x-test-user-id', testUser.id)
      .send({
        nightscoutUrl: 'not-a-valid-url',
        _csrf: csrfToken,
      });
    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  it('should return 403 Forbidden if the user has not signed agreements', async () => {
    const unagreedUser = await testPrisma.user.create({
      data: {
        email: `unagreed-user-${Date.now()}@test.com`,
        agreementsSigned: false,
      },
    });

    const response = await agent
      .put('/api/user/settings')
      .set('x-test-user-id', unagreedUser.id)
      .send({ preferredUnits: 'MMOL', _csrf: csrfToken });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('AGREEMENTS_NOT_SIGNED');
  });

  it("should successfully update all settings and encrypt the token", async () => {
    const settingsPayload = {
      nightscoutUrl: "https://my-nightscout-instance.com",
      nightscoutToken: "my-secret-token-12345",
      preferredUnits: "MMOL",
      _csrf: csrfToken,
    };

    const response = await agent
      .put("/api/user/settings")
      .set("x-test-user-id", testUser.id)
      .send(settingsPayload);
    expect(response.status).toBe(200);

    const updatedUser = await testPrisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(updatedUser!.nightscoutUrl).toBe(settingsPayload.nightscoutUrl);
    expect(updatedUser!.preferredUnits).toBe("MMOL");
    expect(decrypt(updatedUser!.nightscoutToken!)).toBe(
      settingsPayload.nightscoutToken
    );
  });
});