require('dotenv').config();
const { initDb, getPool } = require('../db');
const bcrypt = require('bcrypt');

async function seed() {
  await initDb();
  const pool = getPool();
  try {
    const pw = await bcrypt.hash('password', 10);

    console.log('Fetching roles...');
    const rolesRes = await pool.query('SELECT id, name FROM roles');
    const rolesMap = {};
    rolesRes.rows.forEach(r => {
      rolesMap[r.name] = r.id;
    });

    console.log('Inserting sample users...');
    const users = [
      { name: 'Admin User', email: 'admin@example.local', roleName: 'ADMIN' },
      { name: 'HR Manager', email: 'hr@example.local', roleName: 'HR' },
      { name: 'Project Manager', email: 'manager@example.local', roleName: 'MANAGER' },
      { name: 'Intern User', email: 'intern@example.local', roleName: 'INTERN' },
    ];

    const userIds = {};

    for (const u of users) {
      const res = await pool.query('SELECT id FROM users WHERE email=$1', [u.email]);
      if (res.rowCount === 0) {
        const roleId = rolesMap[u.roleName];
        if (!roleId) {
          throw new Error(`Role ${u.roleName} not found in DB!`);
        }
        const insert = await pool.query(
          'INSERT INTO users (name, email, password_hash, role_id, status) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [u.name, u.email, pw, roleId, 'active']
        );
        userIds[u.email] = insert.rows[0].id;
        console.log(`Inserted ${u.name} with ID: ${insert.rows[0].id}`);
      } else {
        userIds[u.email] = res.rows[0].id;
        console.log(`Found existing user ${u.name} with ID: ${res.rows[0].id}`);
      }
    }

    console.log('Inserting sample projects...');
    let projectId;
    const pRes = await pool.query('SELECT id FROM projects LIMIT 1');
    if (pRes.rowCount === 0) {
      const managerId = userIds['manager@example.local'];
      const p = await pool.query(
        'INSERT INTO projects (title, description, created_by, deadline, priority, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        ['Website Revamp', 'Redesign corporate website layout and upgrade react framework', managerId, new Date(Date.now() + 30 * 86400000), 'high', 'active']
      );
      projectId = p.rows[0].id;
    } else {
      projectId = pRes.rows[0].id;
    }

    console.log('Inserting sample tasks...');
    const tRes = await pool.query('SELECT id FROM tasks LIMIT 1');
    if (tRes.rowCount === 0) {
      const internId = userIds['intern@example.local'];
      const managerId = userIds['manager@example.local'];
      
      const tasksToInsert = [
        { title: 'Design Figma Mockups', desc: 'Create homepage layouts', assigned: internId, status: 'in_progress', priority: 'high' },
        { title: 'Setup React Router', desc: 'Setup navigation system', assigned: internId, status: 'pending', priority: 'medium' },
        { title: 'Integrate TailwindCSS', desc: 'Apply styling guidelines', assigned: internId, status: 'completed', priority: 'low' },
        { title: 'Review Database Migrations', desc: 'Verify postgres schema constraints', assigned: managerId, status: 'in_progress', priority: 'high' }
      ];

      for (const t of tasksToInsert) {
        await pool.query(
          'INSERT INTO tasks (title, description, project_id, assigned_to, created_by, status, priority, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [t.title, t.desc, projectId, t.assigned, managerId, t.status, t.priority, new Date(Date.now() + 10 * 86400000)]
        );
      }
    }

    console.log('Inserting sample attendance...');
    const attRes = await pool.query('SELECT id FROM attendance LIMIT 1');
    if (attRes.rowCount === 0) {
      for (const email of Object.keys(userIds)) {
        const uId = userIds[email];
        await pool.query(
          'INSERT INTO attendance (user_id, attendance_date, check_in, status) VALUES ($1, CURRENT_DATE, $2, $3)',
          [uId, new Date(new Date().setHours(9, 0, 0)), 'present']
        );
      }
    }

    console.log('Inserting sample leaves...');
    const leaveRes = await pool.query('SELECT id FROM leaves LIMIT 1');
    if (leaveRes.rowCount === 0) {
      const internId = userIds['intern@example.local'];
      await pool.query(
        'INSERT INTO leaves (user_id, start_date, end_date, reason, status) VALUES ($1, $2, $3, $4, $5)',
        [internId, new Date(Date.now() + 5 * 86400000), new Date(Date.now() + 7 * 86400000), 'Doctor appointment checkup', 'pending']
      );
    }

    console.log('Inserting sample announcements...');
    const annRes = await pool.query('SELECT id FROM announcements LIMIT 1');
    if (annRes.rowCount === 0) {
      const adminId = userIds['admin@example.local'];
      await pool.query(
        'INSERT INTO announcements (title, message, created_by) VALUES ($1, $2, $3)',
        ['Welcome to the TaskFlow System', 'All employees are requested to log their attendance daily.', adminId]
      );
    }

    console.log('Inserting sample chat & message...');
    const chatRes = await pool.query('SELECT id FROM chats LIMIT 1');
    let chatId;
    if (chatRes.rowCount === 0) {
      const chatInsert = await pool.query(
        'INSERT INTO chats (name, type, project_id) VALUES ($1, $2, $3) RETURNING id',
        ['Website Revamp Group', 'project', projectId]
      );
      chatId = chatInsert.rows[0].id;
      
      // Add participants
      for (const email of Object.keys(userIds)) {
        await pool.query(
          'INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2)',
          [chatId, userIds[email]]
        );
      }

      // Add sample message
      const managerId = userIds['manager@example.local'];
      await pool.query(
        'INSERT INTO messages (chat_id, sender_id, content, type, status) VALUES ($1, $2, $3, $4, $5)',
        [chatId, managerId, 'Hello team, let us coordinate on tasks here!', 'text', 'delivered']
      );
    }

    console.log('Inserting sample performance scores...');
    const perfRes = await pool.query('SELECT id FROM performance_scores LIMIT 1');
    if (perfRes.rowCount === 0) {
      const internId = userIds['intern@example.local'];
      const managerId = userIds['manager@example.local'];
      await pool.query(
        'INSERT INTO performance_scores (user_id, score, period, notes, created_by) VALUES ($1, $2, $3, $4, $5)',
        [internId, 85, '2026-Q2', 'Solid work on frontend UI templates', managerId]
      );
    }

    console.log('Seeding complete');
    process.exit(0);
  } catch (err) {
    console.error('Error during seeding:', err);
    process.exit(1);
  }
}

seed();
