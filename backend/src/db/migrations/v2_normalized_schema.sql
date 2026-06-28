-- V2 Normalized Database Schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing tables/views if they conflict
DROP VIEW IF EXISTS leaderboard;
DROP VIEW IF EXISTS profiles;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS meeting_participants CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chat_participants CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS leaves CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS performance_scores CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- 1. Roles
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial roles
INSERT INTO roles (name, description) VALUES
  ('ADMIN', 'System Administrator with full access'),
  ('HR', 'Human Resources Manager'),
  ('MANAGER', 'Project/Team Manager'),
  ('INTERN', 'Junior or temporary staff member');

-- 2. Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  role TEXT, -- Cache/Legacy column synchronized via trigger
  status TEXT DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to sync user role name from role_id
CREATE OR REPLACE FUNCTION sync_user_role_field()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_id IS NOT NULL THEN
    SELECT name INTO NEW.role FROM roles WHERE id = NEW.role_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_user_role
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION sync_user_role_field();

-- 3. Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deadline TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Attendance
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  attendance_date DATE DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  hours NUMERIC,
  status TEXT DEFAULT 'present',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Leaves
CREATE TABLE leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Chats (Conversations)
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT NOT NULL, -- direct, group, project
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat Participants
CREATE TABLE chat_participants (
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (chat_id, user_id)
);

-- 9. Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT,
  type TEXT DEFAULT 'text', -- text, file
  file_url TEXT,
  status TEXT DEFAULT 'sent', -- sent, delivered, seen
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Meetings
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  host_id UUID REFERENCES users(id) ON DELETE SET NULL,
  meeting_link TEXT,
  status TEXT DEFAULT 'scheduled', -- scheduled, ongoing, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Meeting Participants
CREATE TABLE meeting_participants (
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (meeting_id, user_id)
);

-- 11. Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  link_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Files
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Support performance scores (for existing page support)
CREATE TABLE performance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER,
  period TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing for speed
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_attendance_user_id ON attendance(user_id);
CREATE INDEX idx_leaves_user_id ON leaves(user_id);
CREATE INDEX idx_announcements_created_by ON announcements(created_by);
CREATE INDEX idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_meetings_host_id ON meetings(host_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);

-- Create a view profiles for legacy support
CREATE OR REPLACE VIEW profiles AS
SELECT id, name, email, role, status, avatar_url, created_at
FROM users;

-- Leaderboard view for performance leaderboard
CREATE OR REPLACE VIEW leaderboard AS
SELECT u.id AS user_id, u.name AS name, COALESCE(AVG(p.score), 0) AS avg_score
FROM users u
LEFT JOIN performance_scores p ON p.user_id = u.id
GROUP BY u.id, u.name
ORDER BY avg_score DESC;

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  task_id UUID,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task Assignments compatibility view
CREATE OR REPLACE VIEW task_assignments AS
SELECT id AS task_id, assigned_to
FROM tasks
WHERE assigned_to IS NOT NULL;
