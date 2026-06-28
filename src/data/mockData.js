export const mockUsers = [
    { id: 'u1', name: 'Aarav Sharma', email: 'admin@taskflow.io', role: 'ADMIN', status: 'active', avatar: '', createdAt: '2025-01-10T08:00:00Z' },
    { id: 'u2', name: 'Priya Patel', email: 'priya@taskflow.io', role: 'PROJECT_MANAGER', status: 'active', avatar: '', createdAt: '2025-02-14T10:30:00Z' },
    { id: 'u3', name: 'Rohan Mehta', email: 'rohan@taskflow.io', role: 'TEAM_LEADER', status: 'active', avatar: '', createdAt: '2025-03-01T09:15:00Z' },
    { id: 'u4', name: 'Sneha Gupta', email: 'sneha@taskflow.io', role: 'TEAM_MEMBER', status: 'active', avatar: '', createdAt: '2025-03-20T14:00:00Z' },
    { id: 'u5', name: 'Vikram Singh', email: 'vikram@taskflow.io', role: 'TEAM_LEADER', status: 'active', avatar: '', createdAt: '2025-04-05T11:45:00Z' },
    { id: 'u6', name: 'Ananya Das', email: 'ananya@taskflow.io', role: 'TEAM_MEMBER', status: 'active', avatar: '', createdAt: '2025-04-10T13:20:00Z' },
    { id: 'u7', name: 'Karan Verma', email: 'karan@taskflow.io', role: 'TEAM_MEMBER', status: 'active', avatar: '', createdAt: '2025-04-18T15:45:00Z' },
    { id: 'u8', name: 'Meera Iyer', email: 'meera@taskflow.io', role: 'HR', status: 'active', avatar: '', createdAt: '2025-05-01T09:00:00Z' },
    { id: 'u9', name: 'Arjun Rao', email: 'arjun@taskflow.io', role: 'INTERN', status: 'active', avatar: '', createdAt: '2025-06-01T09:00:00Z' },
];
export const mockProjects = [
    { id: 'p1', title: 'Website Redesign', description: 'Complete overhaul of the company website with modern design and improved UX.', createdBy: 'u1', assignedUsers: ['u2', 'u3', 'u5'], deadline: '2026-06-30T00:00:00Z', priority: 'high', createdAt: '2025-05-01T08:00:00Z' },
    { id: 'p2', title: 'Mobile App v2', description: 'Build version 2 of the mobile application with offline support and push notifications.', createdBy: 'u1', assignedUsers: ['u3', 'u5'], deadline: '2026-08-15T00:00:00Z', priority: 'medium', createdAt: '2025-06-15T10:00:00Z' },
    { id: 'p3', title: 'API Migration', description: 'Migrate legacy REST APIs to GraphQL with improved caching and documentation.', createdBy: 'u1', assignedUsers: ['u2', 'u4'], deadline: '2026-05-20T00:00:00Z', priority: 'low', createdAt: '2025-07-20T12:00:00Z' },
];
export const mockTeams = [
    {
        id: 'team-1',
        name: 'Platform Launch Squad',
        description: 'Core delivery team for the redesign and platform rollout.',
        createdBy: 'u1',
        members: ['u2', 'u3', 'u5'],
        projects: ['p1', 'p2'],
        createdAt: '2025-08-01T09:00:00Z',
    },
    {
        id: 'team-2',
        name: 'API Migration Crew',
        description: 'Focused group handling the GraphQL migration workstream.',
        createdBy: 'u1',
        members: ['u2', 'u4'],
        projects: ['p3'],
        createdAt: '2025-08-12T13:30:00Z',
    },
];
export const mockTasks = [
    { id: 't1', title: 'Design homepage mockups', description: 'Create Figma mockups for the new homepage layout.', projectId: 'p1', assignedTo: 'u2', status: 'completed', priority: 'high', dueDate: '2026-05-10T00:00:00Z', createdAt: '2025-05-02T09:00:00Z', comments: [{ id: 'c1', taskId: 't1', userId: 'u1', content: 'Looking great! Please finalize the hero section.', createdAt: '2025-05-05T14:00:00Z' }] },
    { id: 't2', title: 'Implement responsive nav', description: 'Build the responsive navigation bar with mobile hamburger menu.', projectId: 'p1', assignedTo: 'u3', status: 'in_progress', priority: 'high', dueDate: '2026-05-20T00:00:00Z', createdAt: '2025-05-03T10:00:00Z', comments: [] },
    { id: 't3', title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment.', projectId: 'p1', assignedTo: 'u5', status: 'pending', priority: 'medium', dueDate: '2026-05-25T00:00:00Z', createdAt: '2025-05-04T11:00:00Z', comments: [] },
    { id: 't4', title: 'User authentication flow', description: 'Implement login, signup, and password reset with JWT.', projectId: 'p2', assignedTo: 'u3', status: 'in_progress', priority: 'high', dueDate: '2026-07-01T00:00:00Z', createdAt: '2025-06-16T09:00:00Z', comments: [{ id: 'c2', taskId: 't4', userId: 'u3', content: 'OAuth integration pending for Google and GitHub.', createdAt: '2025-06-20T16:00:00Z' }] },
    { id: 't5', title: 'Push notification service', description: 'Integrate Firebase Cloud Messaging for push notifications.', projectId: 'p2', assignedTo: 'u5', status: 'pending', priority: 'medium', dueDate: '2026-07-15T00:00:00Z', createdAt: '2025-06-17T10:00:00Z', comments: [] },
    { id: 't6', title: 'Offline data sync', description: 'Implement offline-first data sync using IndexedDB.', projectId: 'p2', assignedTo: 'u3', status: 'pending', priority: 'low', dueDate: '2026-08-01T00:00:00Z', createdAt: '2025-06-18T11:00:00Z', comments: [] },
    { id: 't7', title: 'Schema migration plan', description: 'Document the migration strategy from REST to GraphQL schemas.', projectId: 'p3', assignedTo: 'u2', status: 'completed', priority: 'high', dueDate: '2026-04-15T00:00:00Z', createdAt: '2025-07-21T09:00:00Z', comments: [] },
    { id: 't8', title: 'GraphQL resolvers', description: 'Write GraphQL resolvers for user and project entities.', projectId: 'p3', assignedTo: 'u2', status: 'in_progress', priority: 'medium', dueDate: '2026-05-01T00:00:00Z', createdAt: '2025-07-22T10:00:00Z', comments: [{ id: 'c3', taskId: 't8', userId: 'u1', content: 'Use DataLoader for batching queries.', createdAt: '2025-07-25T13:00:00Z' }] },
    { id: 't9', title: 'API documentation', description: 'Generate API docs using GraphQL Playground and Swagger.', projectId: 'p3', assignedTo: 'u4', status: 'pending', priority: 'low', dueDate: '2026-05-15T00:00:00Z', createdAt: '2025-07-23T11:00:00Z', comments: [] },
    { id: 't10', title: 'Performance testing', description: 'Run load tests on all API endpoints and optimize slow queries.', projectId: 'p1', assignedTo: 'u5', status: 'pending', priority: 'medium', dueDate: '2026-06-15T00:00:00Z', createdAt: '2025-05-10T14:00:00Z', comments: [] },
    { id: 't11', title: 'Dark mode support', description: 'Implement dark mode toggle with system preference detection.', projectId: 'p1', assignedTo: 'u2', status: 'pending', priority: 'low', dueDate: '2026-06-20T00:00:00Z', createdAt: '2025-05-12T09:00:00Z', comments: [] },
];
export const mockNotifications = [
    { id: 'n1', userId: 'u2', title: 'New Task Assigned', message: 'You have been assigned "Design homepage mockups"', read: false, type: 'task_assigned', createdAt: '2026-04-01T09:00:00Z' },
    { id: 'n2', userId: 'u3', title: 'Task Updated', message: 'Task "Implement responsive nav" priority changed to High', read: false, type: 'task_updated', createdAt: '2026-04-01T10:30:00Z' },
    { id: 'n3', userId: 'u2', title: 'New Comment', message: 'Aarav commented on "Design homepage mockups"', read: true, type: 'comment', createdAt: '2026-03-31T14:00:00Z' },
    { id: 'n4', userId: 'u5', title: 'Project Assigned', message: 'You have been added to "Website Redesign"', read: true, type: 'project_assigned', createdAt: '2026-03-30T11:00:00Z' },
    { id: 'n5', userId: 'u3', title: 'New Task Assigned', message: 'You have been assigned "User authentication flow"', read: false, type: 'task_assigned', createdAt: '2026-04-02T08:00:00Z' },
];
// Mock credentials for login
export const mockCredentials = [
    { email: 'admin@taskflow.io', password: 'admin123', userId: 'u1' },
    { email: 'priya@taskflow.io', password: 'user123', userId: 'u2' },
    { email: 'rohan@taskflow.io', password: 'user123', userId: 'u3' },
    { email: 'sneha@taskflow.io', password: 'user123', userId: 'u4' },
    { email: 'vikram@taskflow.io', password: 'user123', userId: 'u5' },
];

export const mockAttendance = [
    { id: 'a1', userId: 'u2', checkIn: '2026-06-23T08:59:00Z', checkOut: '2026-06-23T17:05:00Z', hours: 8.1 },
    { id: 'a2', userId: 'u3', checkIn: '2026-06-23T09:15:00Z', checkOut: '2026-06-23T17:30:00Z', hours: 8.25 },
    { id: 'a3', userId: 'u4', checkIn: '2026-06-23T09:00:00Z', checkOut: '2026-06-23T16:45:00Z', hours: 7.75 },
];

export const mockPerformance = [
    { id: 'pfs1', userId: 'u2', score: 88, period: '2026-Q2', notes: 'Strong delivery, good collaboration' },
    { id: 'pfs2', userId: 'u3', score: 79, period: '2026-Q2', notes: 'Consistent work but needs to improve tests' },
    { id: 'pfs3', userId: 'u5', score: 92, period: '2026-Q2', notes: 'Excellent performance and mentorship' },
];

export const mockAnnouncements = [
    { id: 'ann1', title: 'All-hands on Friday', message: 'Company-wide all-hands at 10am in the main channel.', createdBy: 'u1', createdAt: '2026-06-20T08:00:00Z' },
    { id: 'ann2', title: 'Holiday Notice', message: 'Office closed on July 4th.', createdBy: 'u8', createdAt: '2026-06-15T12:00:00Z' },
];

