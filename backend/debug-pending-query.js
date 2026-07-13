require('dotenv').config();
const { initDb, getPool } = require('./src/db');

async function run() {
  await initDb();
  const pool = getPool();
  const sql = `SELECT u.id, u.name, u.email, u.status, u.created_at, r.name as role
               FROM users u
               LEFT JOIN roles r ON u.role_id = r.id
               WHERE u.status = 'pending'
               ORDER BY u.created_at DESC`;
  try {
    const { rows } = await pool.query(sql);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
