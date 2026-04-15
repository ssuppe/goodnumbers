import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@src/lib/prisma.js";

describe("Database Connection", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should connect to the database and perform a query", async () => {
    const userCount = await prisma.user.count();
    expect(userCount).toBeGreaterThanOrEqual(0);
  });
});