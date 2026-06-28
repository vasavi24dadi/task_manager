Backend setup

1) Configure `DATABASE_URL` environment variable. Example:

   DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/workforce_crm

2) Run migrations:

   cd backend
   node src/db/migrate_all.js

Notes:
- The migration runner reads all .sql files in `src/db/migrations` in alphabetical order.
- The project expects Postgres to allow the `pgcrypto` extension for UUID generation. If your setup does not allow `pgcrypto`, update the migration SQL to use your preferred id generation.
