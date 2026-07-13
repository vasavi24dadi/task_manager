require('dotenv').config();
const { initDb, getPool } = require('./src/db');

async function test() {
  try {
    await initDb();
    const pool = getPool();
    
    console.log('\n=== Checking admin user ===');
    const adminRes = await pool.query(
      'SELECT u.id, u.name, u.email, u.role_id, u.status, r.name as role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = $1',
      ['admin@company.com']
    );
    console.log('Admin user:', JSON.stringify(adminRes.rows, null, 2));
    
    console.log('\n=== Checking roles table ===');
    const rolesRes = await pool.query('SELECT id, name FROM roles ORDER BY name');
    console.log('Available roles:', JSON.stringify(rolesRes.rows, null, 2));
    
    console.log('\n=== All users with roles ===');
    const allUsersRes = await pool.query(
      'SELECT u.id, u.name, u.email, u.role_id, u.status, r.name as role FROM users u LEFT JOIN roles r ON u.role_id = r.id ORDER BY u.created_at'
    );
    console.log('All users:', JSON.stringify(allUsersRes.rows, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

test();
