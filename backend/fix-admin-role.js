require('dotenv').config();
const { initDb, getPool } = require('./src/db');

async function fixAdminRole() {
  try {
    await initDb();
    const pool = getPool();
    
    // Get ADMIN role ID
    const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', ['ADMIN']);
    if (roleRes.rowCount === 0) {
      throw new Error('ADMIN role not found in database!');
    }
    const adminRoleId = roleRes.rows[0].id;
    
    // Update admin@company.com user with ADMIN role
    const updateRes = await pool.query(
      'UPDATE users SET role_id = $1 WHERE email = $2 RETURNING id, email, role_id',
      [adminRoleId, 'admin@company.com']
    );
    
    if (updateRes.rowCount === 0) {
      throw new Error('admin@company.com user not found!');
    }
    
    console.log('✓ Updated admin user:', JSON.stringify(updateRes.rows[0], null, 2));
    
    // Verify the update
    const verifyRes = await pool.query(
      'SELECT u.id, u.name, u.email, u.role_id, r.name as role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = $1',
      ['admin@company.com']
    );
    console.log('✓ Verified admin user:', JSON.stringify(verifyRes.rows[0], null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fixAdminRole();
