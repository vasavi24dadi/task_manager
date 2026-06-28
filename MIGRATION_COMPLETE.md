# Supabase Migration Complete

## ✅ Migration Status: COMPLETE

This project has been successfully migrated from Supabase to:
- **React** (Frontend)
- **Express.js** (Backend)
- **PostgreSQL** (Database)
- **JWT Authentication** (Security)
- **Socket.IO** (Real-time)

## 📦 Project Structure

### Backend (`/backend`)
```
src/
  index.js              - Main server with Socket.IO
  db.js                 - Database connection
  db/
    migrations/         - SQL migrations
    migrate_all.js      - Migration runner
  middleware/
    auth.js             - JWT & RBAC middleware
  routes/
    auth.js             - Auth endpoints (register, login, logout)
    users.js            - User management (RBAC protected)
    tasks.js            - Task management with role-based access
    projects.js         - Project management
    chats-api.js        - Real-time chat & conversations
    meetings-api.js     - Video/audio meetings & WebRTC
    notifications-api.js - Notification system
    reports.js          - Report generation
    attendance.js       - Attendance tracking
    announcements.js    - HR announcements
    leaves.js           - Leave management
    performance.js      - Performance reviews
    dashboard.js        - Dashboard data
    files.js            - File uploads
```

### Frontend (`/src`)
```
App.jsx                 - Main app (routes)
components/
  ProtectedRoute.jsx    - Route protection with RBAC
  AppLayout.jsx         - Main layout
  AppHeader.jsx         - Header with user info
  AppSidebar.jsx        - Role-based sidebar
  communication/        - Chat components
  deployment/           - Deployment features
  project/              - Project management
  ui/                   - Reusable UI components
services/
  api-rest.js           - REST API client with JWT auth
  api.js                - API adapter
hooks/
  useSocket.js          - Socket.IO hook
  useCallManager.js     - Call management hook
  useNotificationListener.js - Notification listener
lib/
  rbac.js               - Frontend RBAC utility
  socketManager.js      - Socket.IO manager
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

### 2. Setup Environment Variables

**.env (Frontend)**
```
VITE_API_BASE=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

**backend/.env**
```
DATABASE_URL=postgres://user:password@localhost:5432/task_manager
JWT_SECRET=your_super_secret_key_min_32_chars_long
PORT=4000
JWT_EXPIRES_IN=8h
NODE_ENV=development
```

### 3. Create PostgreSQL Database
```bash
createdb task_manager
```

### 4. Run Migrations
```bash
cd backend
npm run migrate
```

### 5. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Both servers will start:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Socket.IO: `ws://localhost:4000`

## 🔐 Authentication & RBAC

### Roles
1. **ADMIN** - Full system access
   - Manage users, roles
   - View all data
   - Full CRUD operations

2. **HR** - Employee management
   - Create/manage interns
   - Approve leaves
   - View attendance
   - Create announcements

3. **MANAGER** - Team management
   - Assign tasks to team
   - Track project progress
   - Approve completed tasks

4. **INTERN** - Basic access
   - View assigned tasks
   - Update task status
   - Apply for leave
   - Submit work files

### Default Test Users
(Created during migration)
```
Admin:    admin@example.com / password123
HR:       hr@example.com / password123
Manager:  manager@example.com / password123
Intern:   intern@example.com / password123
```

Change these passwords in production!

## 📊 Database Schema

### Core Tables
- `users` - Authentication & user data
- `roles` - Role definitions (ADMIN, HR, MANAGER, INTERN)
- `employees` - Employee profiles linked to users
- `projects` - Project management
- `tasks` - Task assignments
- `task_submissions` - Task approval workflow

### Features
- `conversations` - Direct & group chats
- `messages` - Chat messages with reactions
- `meetings` - Video/audio meetings
- `call_history` - Call logs
- `notifications` - User notifications
- `attendance` - Attendance tracking
- `leaves` - Leave requests & approval
- `announcements` - HR announcements
- `performance_reviews` - Performance tracking
- `files` - File uploads
- `activity_logs` - Audit trail

## 🔄 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `POST /api/auth/change-password` - Change password

### Users (Admin/HR)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Tasks (Role-based)
- `GET /api/tasks` - List tasks (filtered by role)
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Chat
- `GET /api/chats/conversations` - List conversations
- `GET /api/chats/conversations/:id/messages` - Get messages
- `POST /api/chats/conversations/:id/messages` - Send message
- `POST /api/chats/conversations/direct/:userId` - Create direct chat
- `POST /api/chats/conversations/group` - Create group chat

### Meetings & Calls
- `GET /api/meetings` - List meetings
- `POST /api/meetings` - Create meeting
- `POST /api/meetings/:id/start` - Start meeting
- `POST /api/meetings/:id/join` - Join meeting
- `POST /api/meetings/:id/end` - End meeting
- `GET /api/calls/history` - Call history
- `POST /api/calls/log` - Log call

### Notifications
- `GET /api/notifications` - Get notifications
- `GET /api/notifications?unread=true` - Get unread
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read/all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Reports
- `GET /api/reports/attendance` - Attendance report
- `GET /api/reports/tasks` - Task completion report
- `GET /api/reports/projects` - Project report
- `GET /api/reports/leaves` - Leave request report
- `GET /api/reports/performance` - Performance report

## 🔌 Socket.IO Events

### Chat
- `message:send` - Send message
- `message:new` - Receive message
- `typing:start` - User typing
- `typing:active` - Show typing indicator
- `typing:stop` - Stop typing
- `typing:inactive` - Hide typing indicator

### Calls
- `call:initiate` - Initiate call
- `call:incoming` - Receive call
- `call:accept` - Accept call
- `call:accepted` - Call accepted
- `call:reject` - Reject call
- `call:rejected` - Call rejected
- `call:end` - End call
- `call:ended` - Call ended

### WebRTC
- `webrtc:offer` - Send offer
- `webrtc:answer` - Send answer
- `webrtc:ice-candidate` - ICE candidate

### Status
- `user:online` - Mark user online
- `user:status` - User status change

## 🧪 Testing

### Test API Endpoints
```bash
# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"intern@example.com","password":"password123"}'

# Get tasks
curl http://localhost:4000/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create task
curl -X POST http://localhost:4000/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"New Task","priority":"high"}'
```

## 🛠️ Frontend Development

### Key Components

**ProtectedRoute.jsx**
- Checks JWT token
- Validates user role
- Redirects unauthorized users
- Redirects to role-based dashboard

**useSocket.js**
- Manages Socket.IO connection
- Auto-reconnect on disconnect
- Handles events

**api-rest.js**
- Intercepts all API calls
- Adds JWT token to headers
- Handles errors
- Rate limiting ready

## 🚢 Deployment

### Environment Variables (Production)
```
DATABASE_URL=postgres://prod_user:prod_pass@prod-host:5432/prod_db
JWT_SECRET=generate_strong_32_char_secret
PORT=8000
NODE_ENV=production
```

### Build
```bash
# Frontend
npm run build

# Backend
npm run build  # if applicable
```

## 📝 Database Backups

```bash
# Backup
pg_dump -U postgres task_manager > backup.sql

# Restore
psql -U postgres task_manager < backup.sql
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 4000
lsof -ti:4000 | xargs kill -9
```

### Database Connection Error
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Check DATABASE_URL
echo $DATABASE_URL
```

### JWT Token Expired
- Tokens expire after 8 hours (configurable via JWT_EXPIRES_IN)
- Frontend should refresh by calling `/api/auth/me`

### Socket.IO Connection Failed
- Check backend is running
- Check VITE_SOCKET_URL matches backend URL
- Check CORS settings in backend/src/index.js

## 📚 Further Implementation

### Features Ready to Use
✅ JWT Authentication with bcrypt
✅ Role-Based Access Control (4 roles)
✅ Real-time chat with Socket.IO
✅ Task & project management
✅ Meeting & call infrastructure
✅ Notifications system
✅ Reports generation
✅ Activity logging

### Optional Enhancements
- [ ] Email notifications
- [ ] File storage (S3/GCS)
- [ ] Video call recording
- [ ] Advanced reporting (PDF/Excel export)
- [ ] Calendar integration
- [ ] Mobile app
- [ ] Dark mode
- [ ] Multi-language support

## 📞 Support

For issues or questions:
1. Check error logs in backend console
2. Verify database connection
3. Check JWT token validity
4. Review Socket.IO connection status

---

**Last Updated**: June 28, 2026
**Status**: ✅ Production Ready
**No Supabase Dependencies**: Verified
