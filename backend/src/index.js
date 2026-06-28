require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const api = require('./routes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', api);

const port = process.env.PORT || 4000;

initDb().then(() => {
  app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
}).catch(err => {
  console.error('Failed to initialize DB', err);
  process.exit(1);
});
