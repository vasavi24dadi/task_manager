const fs = require('fs');
const path = require('path');
const { initDb, getPool } = require('../db');

async function migrate() {
  await initDb();
  const pool = getPool();
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = ['v2_normalized_schema.sql'];
  for (const file of files) {
    const sqlPath = path.join(migrationsDir, file);
    if (!fs.existsSync(sqlPath)) {
      console.warn('Skipping missing migration file:', file);
      continue;
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Applying', file);
    await pool.query(sql);
  }
  console.log('Migrations applied:', files.join(', '));
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
