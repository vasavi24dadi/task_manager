const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

router.get('/', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT id, user_id, employee_number, position, department, manager_id, hire_date, status, created_at FROM employees ORDER BY created_at DESC');
  res.json(rows.map(r => ({ id: r.id, userId: r.user_id, employeeNumber: r.employee_number, position: r.position, department: r.department, managerId: r.manager_id, hireDate: r.hire_date, status: r.status, createdAt: r.created_at })));
});

router.get('/:id', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT id, user_id, employee_number, position, department, manager_id, hire_date, status, created_at FROM employees WHERE id = $1', [req.params.id]);
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const r = rows[0];
  res.json({ id: r.id, userId: r.user_id, employeeNumber: r.employee_number, position: r.position, department: r.department, managerId: r.manager_id, hireDate: r.hire_date, status: r.status, createdAt: r.created_at });
});

router.post('/', async (req, res) => {
  const pool = getPool();
  const { userId, employeeNumber, position, department, managerId, hireDate, status } = req.body;
  const { rows } = await pool.query('INSERT INTO employees (user_id, employee_number, position, department, manager_id, hire_date, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, user_id, employee_number, position, department, manager_id, hire_date, status, created_at', [userId, employeeNumber, position, department, managerId, hireDate, status || 'active']);
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const pool = getPool();
  const id = req.params.id;
  const { userId, employeeNumber, position, department, managerId, hireDate, status } = req.body;
  const fields = [];
  const vals = [];
  let idx = 1;
  if (userId) { fields.push(`user_id=$${idx++}`); vals.push(userId); }
  if (employeeNumber) { fields.push(`employee_number=$${idx++}`); vals.push(employeeNumber); }
  if (position) { fields.push(`position=$${idx++}`); vals.push(position); }
  if (department) { fields.push(`department=$${idx++}`); vals.push(department); }
  if (managerId) { fields.push(`manager_id=$${idx++}`); vals.push(managerId); }
  if (hireDate) { fields.push(`hire_date=$${idx++}`); vals.push(hireDate); }
  if (status) { fields.push(`status=$${idx++}`); vals.push(status); }
  vals.push(id);
  const sql = `UPDATE employees SET ${fields.join(',')} WHERE id=$${idx} RETURNING id, user_id, employee_number, position, department, manager_id, hire_date, status, created_at`;
  const { rows } = await pool.query(sql, vals);
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const pool = getPool();
  await pool.query('DELETE FROM employees WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
