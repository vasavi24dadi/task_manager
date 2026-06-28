-- Compatibility view so older code referencing `profiles` still works
CREATE OR REPLACE VIEW profiles AS
SELECT id, name, email, role, status, avatar_url, created_at
FROM users;
