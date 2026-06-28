-- Workforce CRM schema migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users (application auth / admin accounts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT DEFAULT 'EMPLOYEE',
  status TEXT DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Employees (business model separate from auth accounts)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  employee_number TEXT UNIQUE,
  position TEXT,
  department TEXT,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  hire_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active',
  priority TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  priority TEXT,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  hours NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance scores
CREATE TABLE IF NOT EXISTS performance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  score INTEGER,
  period TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_employee_id ON performance_scores(employee_id);

-- Sample seed (safe, id auto-generated) - comment out if undesired
INSERT INTO users (name, email, role)
SELECT 'Demo Admin', 'admin@example.local', 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@example.local');

-- Create a sample employee linked to demo admin user if none exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM employees) THEN
    INSERT INTO employees (user_id, employee_number, position, department)
    SELECT id, 'EMP-0001', 'HR Manager', 'HR' FROM users WHERE email = 'admin@example.local' LIMIT 1;
  END IF;
END$$;

-- Leaderboard helper
CREATE OR REPLACE VIEW leaderboard AS
SELECT e.id AS employee_id, u.name AS name, AVG(p.score) AS avg_score
FROM performance_scores p
JOIN employees e ON e.id = p.employee_id
LEFT JOIN users u ON u.id = e.user_id
GROUP BY e.id, u.name
ORDER BY avg_score DESC;
