// file: goodnumbers-workspace/src/server/routes/journals.test.ts
import request from 'supertest';
import app from '../../src/index'; // Corrected path to app
import { prisma } from '../../src/db'; // Corrected path to prisma
import { createId } from '@paralleldrive/cuid2';

// Jest's global functions (describe, it, expect, beforeAll, afterAll) are available without explicit imports.

let testUser;
let otherUser;
let testJournal;

beforeAll(async () => {
  [testUser, otherUser] = await Promise.all([
    prisma.user.create({
      data: { email: 'testuser@example.com', name: 'Test User' },
    }),
    prisma.user.create({
      data: { email: 'otheruser@example.com', name: 'Other User' },
    }),
  ]);

  testJournal = await prisma.journal.create({
    data: {
      id: createId(), // Use cuid to match schema
      userId: testUser.id,
      status: 'COMPLETE',
      podcastTitle: 'Test Journal',
    },
  });
});

afterAll(async () => {
  await prisma.journal.deleteMany({});
  await prisma.user.deleteMany({});
});

describe('Journal Read APIs', () => {
  describe('GET /api/journals', () => {
    it('should return 401 Unauthorized if user is not logged in', async () => {
      const response = await request(app).get('/api/journals');
      expect(response.status).toBe(401);
    });

    it('should return 200 OK and an array of journals for the logged-in user', async () => {
      const response = await request(app)
        .get('/api/journals')
        .set('x-test-user-id', testUser.id);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe(testJournal.id);
    });

    it('should return 200 OK and an empty array for a user with no journals', async () => {
      const response = await request(app)
        .get('/api/journals')
        .set('x-test-user-id', otherUser.id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/journals/:id', () => {
    it('should return 401 Unauthorized if user is not logged in', async () => {
      const response = await request(app).get(
        `/api/journals/${testJournal.id}`,
      );
      expect(response.status).toBe(401);
    });

    it('should return 400 Bad Request for an invalid ID format', async () => {
      const response = await request(app)
        .get(`/api/journals/not-a-valid-id`)
        .set('x-test-user-id', testUser.id);
      expect(response.status).toBe(400);
    });

    it('should return 404 Not Found if journal belongs to another user', async () => {
      const response = await request(app)
        .get(`/api/journals/${testJournal.id}`)
        .set('x-test-user-id', otherUser.id);
      expect(response.status).toBe(404);
    });

    it('should return 200 OK and the journal data if user is owner', async () => {
      const response = await request(app)
        .get(`/api/journals/${testJournal.id}`)
        .set('x-test-user-id', testUser.id);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testJournal.id);
    });
  });
});
