// file: Frontend/src/server.ts
import { createApp } from './index.js';

const app = createApp();
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[Server] Express server is running on http://localhost:${PORT}`);
});
