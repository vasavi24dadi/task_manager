const fs = require('fs');
const path = require('path');
const { initDb, getPool } = require('../db');

async function migrate() {
  await initDb();
  const pool = getPool();
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', 'init.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migrations applied');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
