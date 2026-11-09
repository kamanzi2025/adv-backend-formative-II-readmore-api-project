const express = require('express');

// The Express app on its own, without a database connection or port,
// so tests can use it against a test database.
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'ReadMore API is running' });
});

module.exports = app;
