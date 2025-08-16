import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

// Note: We are exporting the app for testing purposes
export const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// This check ensures the server doesn't start during tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
