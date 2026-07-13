require('dotenv').config();
const { initDb, getPool } = require('./src/db');
const jwt = require('jsonwebtoken');

async function testLoginFlow() {
  try {
    await initDb();
    const pool = getPool();
    
    // Simulate the login endpoint query
    console.log('\n=== Testing Login Query ===');
    const loginQuery = `
      SELECT u.id, u.name, u.email, u.password_hash, u.status, u.avatar_url, u.created_at, u.last_login, r.name as role
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = $1
    `;
    
    const result = await pool.query(loginQuery, ['admin@company.com']);
    console.log('Query result:', JSON.stringify(result.rows[0], null, 2));
    
    const user = result.rows[0];
    if (!user) {
      throw new Error('User not found!');
    }
    
    // Simulate token creation (what backend does)
    const JWT_SECRET = process.env.JWT_SECRET || 'replace_me_with_strong_secret';
    const token = jwt.sign({ sub: user.id, role: user.role || 'INTERN' }, JWT_SECRET);
    console.log('\n=== Generated JWT Token ===');
    console.log('Token created:', token.substring(0, 50) + '...');
    
    // Decode the token to verify
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token payload:', JSON.stringify(decoded, null, 2));
    
    // Simulate what frontend receives
    console.log('\n=== Frontend Response ===');
    const response = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
        lastLogin: user.last_login,
      },
      token: token
    };
    console.log('Login response:', JSON.stringify(response, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testLoginFlow();
