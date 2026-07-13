const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const API = 'http://localhost:4000/api';
const random = Math.random().toString(36).substring(2, 8);
const email = `pending+${random}@example.local`;
const password = 'Password123!';
const name = 'Pending User';
const role = 'INTERN';

async function register() {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function loginAdmin() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.local', password: 'password' }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function getPending(token) {
  const res = await fetch(`${API}/users/pending`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json() };
}

async function approve(token, id) {
  const res = await fetch(`${API}/users/pending/${id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json() };
}

async function loginUser() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, body: await res.json() };
}

(async () => {
  try {
    console.log('Registering user:', email);
    const reg = await register();
    console.log('Register status', reg.status, reg.body);
    if (reg.status !== 201) throw new Error('Register failed');
    if (!reg.body.requiresApproval) throw new Error('Register did not require approval');

    console.log('Logging in as admin...');
    const admin = await loginAdmin();
    console.log('Admin login status', admin.status);
    if (admin.status !== 200 || !admin.body.token) throw new Error('Admin login failed');

    console.log('Fetching pending requests...');
    const pending = await getPending(admin.body.token);
    console.log('Pending response', pending.status, pending.body);
    if (!Array.isArray(pending.body)) throw new Error(`Pending response is not an array: ${JSON.stringify(pending.body)}`);
    const request = pending.body.find((u) => u.email === email);
    if (!request) throw new Error('New pending user not found in pending list');
    console.log('Found pending user:', request);

    console.log('Approving request...');
    const approveRes = await approve(admin.body.token, request.id);
    console.log('Approve status', approveRes.status, approveRes.body);
    if (approveRes.status !== 200) throw new Error('Approve failed');

    console.log('Logging in as approved user...');
    const userLogin = await loginUser();
    console.log('User login status', userLogin.status, userLogin.body);
    if (userLogin.status !== 200) throw new Error('Approved user login failed');

    console.log('Workflow verified successfully');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
