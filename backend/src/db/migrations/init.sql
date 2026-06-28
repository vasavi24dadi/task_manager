-- Minimal schema for migration from Supabase to Postgres

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_by TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  priority TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  assigned_to TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_by TEXT,
  status TEXT,
  priority TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT false,
  type TEXT,
  link_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  check_in TIMESTAMP WITH TIME ZONE,
  check_out TIMESTAMP WITH TIME ZONE,
  hours NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER,
  period TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT,
  message TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Simple helper function for leaderboard (optional)
CREATE OR REPLACE FUNCTION leaderboard_top_scores()
RETURNS TABLE(user_id TEXT, name TEXT, avg_score NUMERIC) AS $$
  SELECT p.user_id, pr.name, AVG(p.score) as avg_score
  FROM performance_scores p
  JOIN profiles pr ON pr.id = p.user_id
  GROUP BY p.user_id, pr.name
  ORDER BY avg_score DESC
  LIMIT 20;
$$ LANGUAGE SQL STABLE;
