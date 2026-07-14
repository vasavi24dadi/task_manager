const API_BASE = import.meta.env.VITE_API_BASE || '';
let activeUserId = null;
let token = null;
let commListeners = new Set();
const conversations = [];
const messagesByConversation = new Map();
const activeCalls = [];

function authHeaders() {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}), ...authHeaders() },
    ...opts,
  });
  const text = await res.text().catch(() => '');
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const message = payload?.error || payload?.message || text || res.statusText;
    const error = new Error(message);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }
  return res.status === 204 ? null : (payload ?? {});
}

function mapProfileRow(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    status: profile.status,
    avatarUrl: profile.avatar_url || null,
    createdAt: profile.created_at,
  };
}

function toProjectRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    deadline: row.deadline,
    priority: row.priority,
    status: row.status,
    assignedUsers: row.assigned_users || row.assignedUsers || [],
  };
}

function toTaskRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    projectId: row.project_id ?? row.projectId,
    assignedTo: row.assigned_to ?? row.assignedTo,
    createdBy: row.created_by ?? row.createdBy,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ?? row.dueDate,
    createdAt: row.created_at ?? row.createdAt,
  };
}

function emitCommunicationEvent(event) {
  commListeners.forEach((listener) => listener(event));
}

export function setActiveUserId(userId) {
  activeUserId = userId;
}

export function setToken(t) {
  token = t;
}

export async function login(email, password) {
  try {
    const body = await fetchJson('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (body?.requiresApproval) {
      return { requiresApproval: true, message: body.message || body.error || 'Your account needs approval.' };
    }
    if (body?.token) token = body.token;
    if (body?.user?.id) activeUserId = body.user.id;
    return { user: mapProfileRow(body.user), token: body.token || '' };
  } catch (err) {
    console.error('[LOGIN]', err.message || err);
    if (err?.payload?.requiresApproval) {
      return { requiresApproval: true, message: err.payload.message || err.payload.error || err.message };
    }
    return { error: err.message || 'Login failed' };
  }
}

export async function register(name, email, password, role = 'INTERN') {
  try {
    const body = await fetchJson('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role }) });
    if (body?.requiresApproval) {
      return { requiresApproval: true, message: body.message || 'Thanks for signing up! Your account is under review.' };
    }
    if (body?.token) token = body.token;
    if (body?.user?.id) activeUserId = body.user.id;
    return { user: mapProfileRow(body.user), token: body.token || '' };
  } catch (err) {
    console.error('[REGISTER]', err.message || err);
    return { error: err.message || 'Registration failed' };
  }
}

export async function restoreSession() {
  if (!activeUserId) return null;
  try {
    const user = await fetchJson(`/users/${activeUserId}`);
    return { user: mapProfileRow(user), token: token || '' };
  } catch {
    return null;
  }
}

export async function logout() {
  activeUserId = null;
  token = null;
  return true;
}

export async function initiateGoogleSignIn() {
  throw new Error('OAuth is not enabled in the REST scaffold');
}

export async function ensureProfileAfterOAuth() {
  throw new Error('OAuth is not enabled in the REST scaffold');
}

export async function changePassword() {
  throw new Error('Change password is not implemented in the REST scaffold');
}

export async function updateOwnProfile(data) {
  if (!activeUserId) throw new Error('Not authenticated');
  const updated = await fetchJson(`/users/${activeUserId}`, { method: 'PUT', body: JSON.stringify(data) });
  return mapProfileRow(updated);
}

export async function getUsers(filters = {}) {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const query = params.toString();
    const users = await fetchJson(`/users${query ? `?${query}` : ''}`);
    return (users || []).map(mapProfileRow);
  } catch {
    return [];
  }
}

export async function getUserById(id) {
  try {
    const user = await fetchJson(`/users/${id}`);
    return mapProfileRow(user);
  } catch {
    return undefined;
  }
}

export async function createUser(data) {
  const created = await fetchJson('/users', { method: 'POST', body: JSON.stringify(data) });
  return { ...mapProfileRow(created), temporaryPassword: created?.temporaryPassword };
}

export async function updateUser(id, data) {
  const updated = await fetchJson(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  return mapProfileRow(updated);
}

export async function deleteUser(id) {
  await fetchJson(`/users/${id}`, { method: 'DELETE' });
  return { ok: true };
}

export async function getPendingUsers() {
  const users = await fetchJson('/users/pending');
  return (users || []).map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.created_at || user.createdAt,
  }));
}

export async function approvePendingUser(id) {
  return fetchJson(`/users/pending/${id}/approve`, { method: 'POST' });
}

export async function rejectPendingUser(id) {
  return fetchJson(`/users/pending/${id}/reject`, { method: 'POST' });
}

export async function resetUserPassword(id, password = 'Welcome123!') {
  const body = await fetchJson(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
  return body;
}

export async function deleteTask(id) {
  await fetchJson(`/tasks/${id}`, { method: 'DELETE' });
  return { ok: true };
}

export async function setTypingIndicator(conversationId, isTyping) {
  return { conversationId, isTyping };
}

export async function deleteMessage(messageId) {
  return { messageId, deleted: true };
}

export async function deleteCallHistory(callId) {
  return { callId, deleted: true };
}

export async function getProjects() {
  try {
    const rows = await fetchJson('/projects');
    return (rows || []).map(toProjectRow);
  } catch {
    return [];
  }
}

export async function getProjectById(id) {
  try {
    const row = await fetchJson(`/projects/${id}`);
    return row ? toProjectRow(row) : undefined;
  } catch {
    return undefined;
  }
}

export async function getProjectsForUser(userId) {
  const rows = await getProjects();
  return rows.filter((project) => project.createdBy === userId || project.assignedUsers?.includes(userId) || project.members?.includes(userId));
}

export async function createProject(data) {
  return fetchJson('/projects', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateProject(id, data) {
  return fetchJson(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteProject(id) {
  await fetchJson(`/projects/${id}`, { method: 'DELETE' });
  return { ok: true };
}

export async function getProjectMembers(projectId) {
  return await fetchJson(`/projects/${projectId}/members`);
}

export async function assignProjectManager(projectId, userId) {
  return { projectId, userId };
}

export async function assignProjectMembers(projectId, userIds) {
  return await fetchJson(
    `/projects/${projectId}/members`,
    {
      method: "PUT",
      body: JSON.stringify({
        userIds,
      }),
    }
  );
}

export async function getTasks() {
  try {
    const rows = await fetchJson('/tasks');
    return (rows || []).map(toTaskRow);
  } catch {
    return [];
  }
}

export async function getTaskById(id) {
  const tasks = await getTasks();
  return tasks.find((task) => task.id === id);
}

export async function getTasksForUser(userId) {
  const tasks = await getTasks();
  return tasks.filter((task) => task.assignedTo === userId || task.createdBy === userId);
}

export async function getTasksForProject(projectId) {
  const tasks = await getTasks();
  return tasks.filter((task) => String(task.projectId) === String(projectId));
}

export async function createTask(data) {
  const created = await fetchJson('/tasks', { method: 'POST', body: JSON.stringify(data) });
  return created;
}

export async function updateTask(id, data) {
  return fetchJson(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function updateTaskStatus(id, status) {
  return updateTask(id, { status });
}

export async function addComment(taskId, userId, content) {
  return { taskId, userId, content };
}

export async function getTeams() {
  try {
    return await fetchJson('/teams');
  } catch {
    return [];
  }
}

export async function createTeam(data) {
  return fetchJson('/teams', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTeam(id, data) {
  return fetchJson(`/teams/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTeam(id) {
  await fetchJson(`/teams/${id}`, { method: 'DELETE' });
  return { ok: true };
}

export async function getNotificationsForUser(userId) {
  try {
    const rows = await fetchJson('/notifications');
    return (rows || []).map((row) => ({
      id: row.id,
      userId: row.userId || row.user_id,
      title: row.title,
      message: row.message,
      read: row.isRead ?? row.read,
      type: row.type,
      createdAt: row.createdAt || row.created_at,
    }));
  } catch {
    return [];
  }
}

export async function markNotificationRead(id) {
  return fetchJson(`/notifications/${id}/read`, { method: 'PUT' });
}

export async function markAllNotificationsRead(userId) {
  return fetchJson('/notifications/read/all', { method: 'PUT' });
}

export async function createAttendance(payload) {
  return fetchJson('/attendance', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateAttendance(id, payload) {
  return fetchJson(`/attendance/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function getAttendanceForUser(userId) {
  try {
    const rows = await fetchJson(`/attendance/${userId}`);
    return (rows || []).map((row) => ({
      id: row.id,
      userId: row.userId || row.user_id,
      employeeId: row.employeeId || row.employee_id,
      attendanceDate: row.attendanceDate || row.attendance_date,
      checkIn: row.checkIn || row.check_in,
      checkOut: row.checkOut || row.check_out,
      hours: row.hours,
      status: row.status,
      createdAt: row.createdAt || row.created_at,
    }));
  } catch {
    return [];
  }
}

export async function createAnnouncement(data) {
  return fetchJson('/announcements', { method: 'POST', body: JSON.stringify(data) });
}

export async function getAnnouncements() {
  try {
    const rows = await fetchJson('/announcements');
    return (rows || []).map((row) => ({ id: row.id, title: row.title, message: row.message, createdBy: row.created_by, createdAt: row.created_at }));
  } catch {
    return [];
  }
}

export async function submitPerformance(userId, data) {
  return fetchJson(`/performance/user/${userId}`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getPerformanceForUser(userId) {
  try {
    const rows = await fetchJson(`/performance/user/${userId}`);
    return (rows || []).map((row) => ({ id: row.id, userId, score: row.score, period: row.period, notes: row.notes, createdAt: row.created_at }));
  } catch {
    return [];
  }
}

export async function getLeaderboard() {
  try {
    const rows = await fetchJson('/performance/leaderboard');
    return (rows || []).map((row) => ({ userId: row.userId || row.user_id, name: row.name, score: Number(row.score || row.avg_score || 0) }));
  } catch {
    return [];
  }
}

export async function getDashboardStats() {
  try {
    return await fetchJson('/dashboard');
  } catch {
    return {
      totalEmployees: 0,
      presentToday: 0,
      pendingTasks: 0,
      completedTasks: 0,
      averagePerformance: 0,
    };
  }
}

export async function createDeploymentRequest() {
  return { ok: true };
}

export async function getDeployments() {
  return [];
}

export async function getDeploymentItems() {
  return [];
}

export async function getDeploymentLogs() {
  return [];
}

export async function approveDeployment() {
  return { ok: true };
}

export async function rejectDeployment() {
  return { ok: true };
}

export async function deployToEnvironment() {
  return { ok: true };
}

export async function submitProject() {
  return { ok: true };
}

export async function getProjectSubmissions() {
  return [];
}

export async function approveProjectSubmission() {
  return { ok: true };
}

export async function rejectProjectSubmission() {
  return { ok: true };
}

export async function getConversations() {
  return conversations.slice().sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
}

export async function createDirectConversation(otherUserId) {
  if (!activeUserId) throw new Error('Authentication required');
  const existing = conversations.find((conversation) => conversation.type === 'direct' && conversation.participants.includes(otherUserId) && conversation.participants.includes(activeUserId));
  if (existing) return existing;
  const conversation = { id: `direct-${Date.now()}`, type: 'direct', title: 'Direct chat', participants: [activeUserId, otherUserId], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  conversations.push(conversation);
  messagesByConversation.set(conversation.id, []);
  return conversation;
}

export async function createProjectConversation(projectId, title) {
  if (!activeUserId) throw new Error('Authentication required');
  const conversation = { id: `project-${Date.now()}`, type: 'project', title: title || 'Project chat', projectId, participants: [activeUserId], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  conversations.push(conversation);
  messagesByConversation.set(conversation.id, []);
  return conversation;
}

export async function getConversationMessages(conversationId) {
  return messagesByConversation.get(conversationId) || [];
}

export async function sendMessage(input) {
  if (!activeUserId) throw new Error('Authentication required');
  const message = {
    id: input.messageId || `msg-${Date.now()}`,
    conversationId: input.conversationId,
    senderId: input.senderId || activeUserId,
    content: input.content,
    type: input.type || 'text',
    createdAt: input.createdAt || new Date().toISOString(),
    status: 'sent',
  };
  const bucket = messagesByConversation.get(input.conversationId) || [];
  bucket.push(message);
  messagesByConversation.set(input.conversationId, bucket);
  emitCommunicationEvent({ type: 'message:new', message });
  return message;
}

export async function markMessagesSeen(conversationId) {
  emitCommunicationEvent({ type: 'messages:seen', conversationId });
  return true;
}

export async function searchMessages(query) {
  const results = [];
  messagesByConversation.forEach((messages) => {
    messages.forEach((message) => {
      if (message.content?.toLowerCase().includes(query.toLowerCase())) {
        results.push(message);
      }
    });
  });
  return results;
}

export async function getTypingUsers(conversationId) {
  return [];
}

export function subscribeCommunicationEvents(listener) {
  commListeners.add(listener);
  return () => commListeners.delete(listener);
}

export function subscribeToConversationMessages(conversationId, onMessage) {
  return subscribeCommunicationEvents((event) => {
    if (event.type === 'message:new' && event.message?.conversationId === conversationId) {
      onMessage(event.message);
    }
  });
}

export async function getActiveCalls() {
  return activeCalls.filter((call) => call.status !== 'ended');
}

export async function startCall(conversationId, type) {
  const call = { id: `call-${Date.now()}`, conversationId, type, status: 'ringing', initiatedBy: activeUserId, createdAt: new Date().toISOString() };
  activeCalls.push(call);
  emitCommunicationEvent({ type: 'call:update', call });
  return call;
}

export async function joinCall(callId) {
  const call = activeCalls.find((item) => item.id === callId);
  if (call) {
    call.status = 'ongoing';
    emitCommunicationEvent({ type: 'call:update', call });
  }
  return call;
}

export async function endCall(callId) {
  const call = activeCalls.find((item) => item.id === callId);
  if (call) {
    call.status = 'ended';
    emitCommunicationEvent({ type: 'call:update', call });
  }
  return call;
}

export async function getCallHistory() {
  return [];
}

export function subscribeToActiveCalls(onUpdate) {
  return subscribeCommunicationEvents((event) => {
    if (event.type === 'call:update') {
      onUpdate({ type: 'call:update', call: event.call, callId: event.call?.id });
    }
  });
}

const api = {
  setActiveUserId,
  setToken,
  login,
  register,
  restoreSession,
  logout,
  initiateGoogleSignIn,
  ensureProfileAfterOAuth,
  changePassword,
  updateOwnProfile,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  deleteTask,
  setTypingIndicator,
  deleteMessage,
  deleteCallHistory,
  getProjects,
  getProjectById,
  getProjectsForUser,
  createProject,
  updateProject,
  deleteProject,
  getProjectMembers,
  assignProjectManager,
  assignProjectMembers,
  getTasks,
  getTaskById,
  getTasksForUser,
  getTasksForProject,
  createTask,
  updateTask,
  updateTaskStatus,
  addComment,
  getTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  createAttendance,
  updateAttendance,
  getAttendanceForUser,
  createAnnouncement,
  getAnnouncements,
  submitPerformance,
  getPerformanceForUser,
  getLeaderboard,
  getDashboardStats,
  createDeploymentRequest,
  getDeployments,
  getDeploymentItems,
  getDeploymentLogs,
  approveDeployment,
  rejectDeployment,
  deployToEnvironment,
  submitProject,
  getProjectSubmissions,
  approveProjectSubmission,
  rejectProjectSubmission,
  getConversations,
  createDirectConversation,
  createProjectConversation,
  getConversationMessages,
  sendMessage,
  markMessagesSeen,
  searchMessages,
  getTypingUsers,
  subscribeCommunicationEvents,
  subscribeToConversationMessages,
  getActiveCalls,
  startCall,
  joinCall,
  endCall,
  getCallHistory,
  subscribeToActiveCalls,
};

export default api;
