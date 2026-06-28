-- Complete normalized Employee Task & Project Management System schema
-- Replaces Supabase with pure PostgreSQL + Express

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ROLES & PERMISSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- 'ADMIN', 'HR', 'MANAGER', 'INTERN'
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES
  ('ADMIN', 'Full system access', '{"manage_users": true, "manage_roles": true, "view_all": true, "manage_all": true}'::jsonb),
  ('HR', 'HR operations and employee management', '{"manage_interns": true, "manage_announcements": true, "approve_leave": true, "view_employees": true}'::jsonb),
  ('MANAGER', 'Team and project management', '{"manage_team": true, "assign_tasks": true, "view_team_performance": true}'::jsonb),
  ('INTERN', 'Basic employee access', '{"submit_tasks": true, "apply_leave": true, "view_own_data": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'suspended'
  avatar_url TEXT,
  phone TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================================
-- EMPLOYEES & ORGANIZATIONAL STRUCTURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_number TEXT UNIQUE NOT NULL,
  position TEXT,
  department TEXT,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  hire_date DATE,
  salary NUMERIC,
  status TEXT DEFAULT 'active',
  skills JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_manager_id ON employees(manager_id);
CREATE INDEX idx_employees_department ON employees(department);

-- ============================================================================
-- PROJECTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active', -- 'planning', 'active', 'completed', 'archived'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  start_date DATE,
  end_date DATE,
  budget NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================================================
-- TASKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'blocked', 'cancelled'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  due_date TIMESTAMPTZ,
  estimated_hours NUMERIC,
  actual_hours NUMERIC,
  completion_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assigned_to_id ON tasks(assigned_to_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- ============================================================================
-- TASK SUBMISSIONS & APPROVAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  submitted_by_id UUID NOT NULL REFERENCES employees(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'revision_needed'
  submission_date TIMESTAMPTZ DEFAULT now(),
  approval_date TIMESTAMPTZ,
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  feedback TEXT,
  files JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_task_submissions_task_id ON task_submissions(task_id);
CREATE INDEX idx_task_submissions_status ON task_submissions(status);

-- ============================================================================
-- ATTENDANCE & TIME TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  hours_worked NUMERIC,
  status TEXT DEFAULT 'present', -- 'present', 'absent', 'late', 'leave'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE UNIQUE INDEX idx_attendance_date_employee ON attendance(employee_id, attendance_date);

-- ============================================================================
-- LEAVES & TIME OFF
-- ============================================================================

CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- 'Vacation', 'Sick Leave', 'Personal', etc.
  max_days_per_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO leave_types (name, max_days_per_year) VALUES
  ('Vacation', 20),
  ('Sick Leave', 10),
  ('Personal Leave', 5),
  ('Maternity Leave', 180),
  ('Bereavement Leave', 3)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  number_of_days INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_date TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_leaves_employee_id ON leaves(employee_id);
CREATE INDEX idx_leaves_status ON leaves(status);
CREATE INDEX idx_leaves_dates ON leaves(start_date, end_date);

-- ============================================================================
-- ANNOUNCEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  status TEXT DEFAULT 'published', -- 'draft', 'published', 'archived'
  target_roles JSONB DEFAULT '[]', -- Array of role IDs or 'all'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_created_by_id ON announcements(created_by_id);

-- ============================================================================
-- CHAT & COMMUNICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT DEFAULT 'direct', -- 'direct', 'group'
  name TEXT, -- For group conversations
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conversations_created_by_id ON conversations(created_by_id);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'file', 'image', 'video', 'call_notification'
  file_url TEXT,
  file_type TEXT,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  reactions JSONB DEFAULT '{}', -- {'emoji': ['user_id1', 'user_id2']}
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- ============================================================================
-- MEETINGS & VIDEO/AUDIO CALLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  meeting_type TEXT DEFAULT 'video', -- 'video', 'audio', 'scheduled'
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  meeting_url TEXT,
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'cancelled'
  max_participants INTEGER,
  recording_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_meetings_organizer_id ON meetings(organizer_id);
CREATE INDEX idx_meetings_status ON meetings(status);

CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'invited', -- 'invited', 'joined', 'left', 'declined'
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX idx_meeting_participants_user_id ON meeting_participants(user_id);

-- ============================================================================
-- CALL HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  callee_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  call_type TEXT DEFAULT 'audio', -- 'audio', 'video'
  status TEXT DEFAULT 'completed', -- 'completed', 'missed', 'rejected', 'cancelled'
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_call_history_caller_id ON call_history(caller_id);
CREATE INDEX idx_call_history_callee_id ON call_history(callee_id);
CREATE INDEX idx_call_history_started_at ON call_history(started_at);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'task_assigned', 'project_assigned', 'leave_approved', 'meeting_reminder', 'announcement', 'message', 'call'
  title TEXT NOT NULL,
  message TEXT,
  related_entity_type TEXT, -- 'task', 'project', 'leave', 'meeting', 'announcement'
  related_entity_id UUID,
  related_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ============================================================================
-- FILE MANAGEMENT & UPLOADS
-- ============================================================================

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_size INTEGER, -- in bytes
  file_type TEXT, -- MIME type
  file_url TEXT NOT NULL, -- Storage path or URL
  storage_type TEXT DEFAULT 'local', -- 'local', 's3', 'gcs'
  uploaded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  related_entity_type TEXT, -- 'task', 'project', 'message', 'profile'
  related_entity_id UUID,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_files_uploaded_by_id ON files(uploaded_by_id);
CREATE INDEX idx_files_related_entity ON files(related_entity_type, related_entity_id);

-- ============================================================================
-- PERFORMANCE & REVIEWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_period TEXT, -- 'Q1', 'Q2', etc.
  feedback TEXT,
  goals JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending', -- 'pending', 'submitted', 'completed'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_performance_reviews_employee_id ON performance_reviews(employee_id);
CREATE INDEX idx_performance_reviews_reviewer_id ON performance_reviews(reviewer_id);

-- ============================================================================
-- ACTIVITY LOGS & AUDIT TRAIL
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT, -- 'task', 'project', 'user', 'announcement'
  entity_id UUID,
  changes JSONB, -- before/after values
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Employee task summary
CREATE OR REPLACE VIEW employee_tasks_summary AS
SELECT 
  e.id,
  u.name,
  COUNT(t.id) as total_tasks,
  SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
  SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
  SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_tasks
FROM employees e
LEFT JOIN users u ON e.user_id = u.id
LEFT JOIN tasks t ON e.id = t.assigned_to_id
GROUP BY e.id, u.name;

-- Project progress
CREATE OR REPLACE VIEW project_progress AS
SELECT 
  p.id,
  p.name,
  COUNT(t.id) as total_tasks,
  SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
  ROUND(100.0 * SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id), 0), 2) as progress_percentage
FROM projects p
LEFT JOIN tasks t ON p.id = t.project_id
GROUP BY p.id, p.name;

-- Attendance summary
CREATE OR REPLACE VIEW attendance_summary AS
SELECT 
  e.id,
  u.name,
  COUNT(CASE WHEN a.status = 'present' THEN 1 END) as days_present,
  COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as days_absent,
  COUNT(CASE WHEN a.status = 'late' THEN 1 END) as days_late,
  AVG(a.hours_worked) as avg_daily_hours
FROM employees e
LEFT JOIN users u ON e.user_id = u.id
LEFT JOIN attendance a ON e.id = a.employee_id AND a.attendance_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY e.id, u.name;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert sample users for each role if they don't exist
DO $$
DECLARE
  admin_role_id UUID;
  hr_role_id UUID;
  manager_role_id UUID;
  intern_role_id UUID;
  admin_user_id UUID;
  hr_user_id UUID;
BEGIN
  -- Get role IDs
  admin_role_id := (SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1);
  hr_role_id := (SELECT id FROM roles WHERE name = 'HR' LIMIT 1);
  manager_role_id := (SELECT id FROM roles WHERE name = 'MANAGER' LIMIT 1);
  intern_role_id := (SELECT id FROM roles WHERE name = 'INTERN' LIMIT 1);

  -- Create sample users
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@example.com') THEN
    INSERT INTO users (name, email, password_hash, role_id, status)
    VALUES ('Admin User', 'admin@example.com', 
            '$2b$10$YIvGy/AwKPSv0WdSyCHGS.4JYDMm6zfQgVJ5h6BKVqSIVkFvdgMOi', -- Password: password123 (bcrypt)
            admin_role_id, 'active');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'hr@example.com') THEN
    INSERT INTO users (name, email, password_hash, role_id, status)
    VALUES ('HR Manager', 'hr@example.com',
            '$2b$10$YIvGy/AwKPSv0WdSyCHGS.4JYDMm6zfQgVJ5h6BKVqSIVkFvdgMOi',
            hr_role_id, 'active');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'manager@example.com') THEN
    INSERT INTO users (name, email, password_hash, role_id, status)
    VALUES ('Team Manager', 'manager@example.com',
            '$2b$10$YIvGy/AwKPSv0WdSyCHGS.4JYDMm6zfQgVJ5h6BKVqSIVkFvdgMOi',
            manager_role_id, 'active');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'intern@example.com') THEN
    INSERT INTO users (name, email, password_hash, role_id, status)
    VALUES ('Intern User', 'intern@example.com',
            '$2b$10$YIvGy/AwKPSv0WdSyCHGS.4JYDMm6zfQgVJ5h6BKVqSIVkFvdgMOi',
            intern_role_id, 'active');
  END IF;

  -- Create sample employees
  admin_user_id := (SELECT id FROM users WHERE email = 'admin@example.com' LIMIT 1);
  hr_user_id := (SELECT id FROM users WHERE email = 'hr@example.com' LIMIT 1);

  IF admin_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM employees WHERE user_id = admin_user_id) THEN
    INSERT INTO employees (user_id, employee_number, position, department, hire_date)
    VALUES (admin_user_id, 'EMP-0001', 'System Administrator', 'Administration', CURRENT_DATE);
  END IF;

  IF hr_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM employees WHERE user_id = hr_user_id) THEN
    INSERT INTO employees (user_id, employee_number, position, department, hire_date)
    VALUES (hr_user_id, 'EMP-0002', 'HR Manager', 'Human Resources', CURRENT_DATE);
  END IF;
END $$;
