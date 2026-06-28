require('dotenv').config();

const { Pool } = require('pg');

let pool = null;

async function initDb() {
  if (pool) return pool;

  console.log("DATABASE_URL:", process.env.DATABASE_URL);

  const connectionString =
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/workforce_crm';

  pool = new Pool({ connectionString });

  await pool.query('SELECT 1');
  console.log('Connected to Postgres');

  return pool;
}

function getPool() {
  if (!pool) throw new Error('DB not initialized');
  return pool;
}

module.exports = { initDb, getPool };