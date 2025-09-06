import 'dotenv/config';

// Do NOT set process.env.AUTH_URL here.
// We want Auth.js to infer the URL from the supertest request headers,
// which is allowed because `trustHost` is true in the test environment.