// goodnumbers-workspace/goodnumbers/tests/integration/journals.test.ts
import request from 'supertest';
import app from '../../src/index'; // Corrected path to app
import { prisma } from '../../src/db'; // Corrected path to prisma
import { createId } from '@paralleldrive/cuid2';

// Jest's global functions (describe, it, expect, beforeAll, afterAll) are available without explicit imports.

let testUser;
let otherUser;
let testJournal;

beforeAll(async () => {
  await prisma.glycemicEventCluster.deleteMany({});
  await prisma.journal.deleteMany({});
  await prisma.user.deleteMany({});

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
      id: createId(), // Use createId to match schema
      userId: testUser.id,
      status: 'COMPLETE',
      podcastTitle: 'Test Journal',
    },
  });
});

afterAll(async () => {
  await prisma.glycemicEventCluster.deleteMany({});
  await prisma.journal.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
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
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].userId).toBe(testUser.id);
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

describe('CSRF Protection', () => {
  it('should generate a CSRF token', async () => {
    const response = await request(app).get('/api/csrf-token');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('csrfToken');
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('should reject a POST request without a CSRF token', async () => {
    const response = await request(app)
      .post('/api/journals')
      .set('x-test-user-id', testUser.id)
      .send({});
    expect(response.status).toBe(403);
  });
});

describe('Journal Creation and Status APIs', () => {
  let createdJournalId: string;
  let agent: request.SuperAgentTest;
  let csrfToken: string;

  beforeAll(async () => {
    agent = request.agent(app);
    const tokenRes = await agent.get('/api/csrf-token');
    csrfToken = tokenRes.body.csrfToken;
  });

  it('POST /api/journals should return 401 Unauthorized if user is not logged in', async () => {
    const response = await request(app).post('/api/journals').send({});
    expect(response.status).toBe(401);
  });

  it('POST /api/journals should create a new journal with a valid CSRF token', async () => {
    const response = await agent
      .post('/api/journals')
      .set('x-test-user-id', testUser.id)
      .set('x-csrf-token', csrfToken)
      .send({});

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.userId).toBe(testUser.id);
    expect(response.body.status).toBe('PENDING');
    createdJournalId = response.body.id; // Save for next tests
  });

  it('GET /api/journals/status/:id should return 401 Unauthorized if user is not logged in', async () => {
    const response = await request(app).get(
      `/api/journals/status/${createdJournalId}`,
    );
    expect(response.status).toBe(401);
  });

  it('GET /api/journals/status/:id should return 404 if another user tries to get status', async () => {
    const response = await request(app)
      .get(`/api/journals/status/${createdJournalId}`)
      .set('x-test-user-id', otherUser.id);
    expect(response.status).toBe(404);
  });

  it('GET /api/journals/status/:id should return 200 and the correct status for the owner', async () => {
    const response = await request(app)
      .get(`/api/journals/status/${createdJournalId}`)
      .set('x-test-user-id', testUser.id);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('PENDING');
    expect(response.body.progress).toBe(0);
  });
});

// --- MISSING TESTS ADDED BELOW ---

describe('PUT /api/journals/:id', () => {
  let clusterToUpdate;
  let agent: request.SuperAgentTest;
  let csrfToken: string;

  beforeAll(async () => {
    clusterToUpdate = await prisma.glycemicEventCluster.create({
      data: {
        id: createId(),
        journalId: testJournal.id,
        eventType: 'HIGH',
        eventCount: 5,
        meanTimeMinutes: 120,
        clusterDataJson: {},
      },
    });

    agent = request.agent(app);
    const tokenRes = await agent.get('/api/csrf-token');
    csrfToken = tokenRes.body.csrfToken;
  });

  it('should return 401 Unauthorized if user is not logged in', async () => {
    const response = await request(app)
      .put(`/api/journals/${testJournal.id}`)
      .send({});
    expect(response.status).toBe(401);
  });

  it('should return 403 Forbidden without a CSRF token', async () => {
    const response = await agent
      .put(`/api/journals/${testJournal.id}`)
      .set('x-test-user-id', testUser.id)
      .send({ weeklyVibe: 'Good' }); // No CSRF token
    expect(response.status).toBe(403);
  });

  it('should return 400 Bad Request for invalid data', async () => {
    const response = await agent
      .put(`/api/journals/${testJournal.id}`)
      .set('x-test-user-id', testUser.id)
      .set('x-csrf-token', csrfToken)
      .send({ weeklyVibe: 123 }); // Invalid data type
    expect(response.status).toBe(400);
  });

  it('should correctly update the journal and its cluster notes', async () => {
    const updateData = {
      weeklyVibe: 'Sprouting',
      goalsForNextWeek: 'Test my new API endpoints.',
      influencingFactors: ['Good Sleep', 'Quiet Week'],
      clusterNotes: {
        [clusterToUpdate.id]: 'This is a note for the cluster.',
      },
    };
    const response = await agent
      .put(`/api/journals/${testJournal.id}`)
      .set('x-test-user-id', testUser.id)
      .set('x-csrf-token', csrfToken)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.weeklyVibe).toBe(updateData.weeklyVibe);

    const updatedCluster = await prisma.glycemicEventCluster.findUnique({
      where: { id: clusterToUpdate.id },
    });
    expect(updatedCluster.userNotes).toBe(
      updateData.clusterNotes[clusterToUpdate.id],
    );
  });
});

describe('DELETE /api/journals/:id', () => {
  let journalToDelete;
  let agent: request.SuperAgentTest;
  let csrfToken: string;

  beforeAll(async () => {
    agent = request.agent(app);
    const tokenRes = await agent.get('/api/csrf-token');
    csrfToken = tokenRes.body.csrfToken;
  });

  beforeEach(async () => {
    journalToDelete = await prisma.journal.create({
      data: {
        userId: testUser.id,
      },
    });
  });

  it('should return 401 Unauthorized if user is not logged in', async () => {
    const response = await request(app).delete(
      `/api/journals/${journalToDelete.id}`,
    );
    expect(response.status).toBe(401);
  });

  it('should return 403 Forbidden without a CSRF token', async () => {
    const response = await agent
      .delete(`/api/journals/${journalToDelete.id}`)
      .set('x-test-user-id', testUser.id);
    // No CSRF token
    expect(response.status).toBe(403);
  });

  it('should delete the journal and return 204 No Content', async () => {
    const response = await agent
      .delete(`/api/journals/${journalToDelete.id}`)
      .set('x-test-user-id', testUser.id)
      .set('x-csrf-token', csrfToken);

    expect(response.status).toBe(204);

    const found = await prisma.journal.findUnique({
      where: { id: journalToDelete.id },
    });
    expect(found).toBeNull();
  });
});
