import request from 'supertest';
import { app } from '../../src/index'; // We will create this import later

describe('Pre-Release Access Barrier', () => {
  it('should redirect to the barrier login page for an unauthenticated request to a protected route', async () => {
    const response = await request(app).get('/api/some-protected-api');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/barrier-login.html');
  });

  it('should return 401 for a login attempt with incorrect credentials', async () => {
    const response = await request(app)
      .post('/api/barrier-login')
      .send({ username: 'wrong', password: 'user' });
    expect(response.status).toBe(401);
  });

  it('should return 200 and set a cookie for a successful login', async () => {
    const response = await request(app).post('/api/barrier-login').send({
      username: process.env.BARRIER_USERNAME,
      password: process.env.BARRIER_PASSWORD,
    });
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('should allow access to a protected route after a successful login', async () => {
    const agent = request.agent(app); // Use an agent to maintain the session cookie

    // First, log in
    await agent.post('/api/barrier-login').send({
      username: process.env.BARRIER_USERNAME,
      password: process.env.BARRIER_PASSWORD,
    });

    // Then, access the protected route
    const response = await agent.get('/api/some-protected-api');
    expect(response.status).toBe(404); // Expect 404 as the route does not exist
  });

  it('should allow unauthenticated access to /health and return 200 OK', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
