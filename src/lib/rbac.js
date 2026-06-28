export const ROLES = {
    ADMIN: 'ADMIN',
    PROJECT_MANAGER: 'PROJECT_MANAGER',
    TEAM_LEADER: 'TEAM_LEADER',
    TEAM_MEMBER: 'TEAM_MEMBER',
    HR: 'HR',
    INTERN: 'INTERN',
};

const legacyToAppRole = {
    VIEWER: ROLES.TEAM_MEMBER,
};

const appToDbRole = {
    [ROLES.ADMIN]: 'ADMIN',
    [ROLES.PROJECT_MANAGER]: 'PROJECT_MANAGER',
    [ROLES.TEAM_LEADER]: 'TEAM_LEADER',
    [ROLES.TEAM_MEMBER]: 'TEAM_MEMBER',
    [ROLES.HR]: 'HR',
    [ROLES.INTERN]: 'INTERN',
};

export function normalizeRole(role) {
    if (!role)
        return role;
    return legacyToAppRole[role] || role;
}

export function toDbRole(role) {
    const normalized = normalizeRole(role);
    return appToDbRole[normalized] || role;
}
const rolePermissions = {
    ADMIN: [
        'users:manage',
        'users:assign-role',
        'projects:create',
        'projects:update',
        'projects:delete',
        'projects:submit',
        'projects:approve',
        'projects:view',
        'tasks:create',
        'tasks:update',
        'tasks:delete',
        'tasks:assign',
        'tasks:update-own-status',
        'tasks:view',
        'comments:add',
        'chat:view',
        'chat:send',
        'chat:create-group',
        'calls:initiate',
        'calls:join',
        'reports:view',
        'dashboard:view',
        'teams:manage',
        'deployments:create',
        'deployments:approve',
        'deployments:deploy',
        'deployments:view',
        'attendance:view',
        'attendance:mark',
        'announcements:manage',
        'announcements:view',
        'performance:view',
        'performance:manage',
        'leaderboard:view',
    ],
    PROJECT_MANAGER: [
        'tasks:create',
        'tasks:update',
        'tasks:delete',
        'tasks:assign',
        'tasks:view',
        'projects:view',
        'projects:submit',
        'projects:approve',
        'comments:add',
        'chat:view',
        'chat:send',
        'chat:create-group',
        'calls:initiate',
        'calls:join',
        'reports:view',
        'dashboard:view',
        'deployments:create',
        'deployments:approve',
        'deployments:deploy',
        'deployments:view',
        'attendance:view',
        'attendance:mark',
        'announcements:view',
        'performance:view',
        'leaderboard:view',
    ],
    TEAM_LEADER: [
        'tasks:update-own-status',
        'tasks:view',
        'comments:add',
        'chat:view',
        'chat:send',
        'calls:initiate',
        'calls:join',
        'dashboard:view',
        'projects:view',
        'projects:submit',
        'deployments:create',
        'deployments:view',
        'attendance:view',
        'attendance:mark',
        'announcements:view',
        'performance:view',
        'leaderboard:view',
    ],
    TEAM_MEMBER: [
        'tasks:view',
        'reports:view',
        'chat:view',
        'chat:send',
        'calls:join',
        'dashboard:view',
        'projects:view',
        'projects:submit',
        'deployments:create',
        'deployments:view',
        'attendance:mark',
        'attendance:view',
        'announcements:view',
        'performance:view',
        'leaderboard:view',
    ],
    HR: [
        'users:manage',
        'users:assign-role',
        'reports:view',
        'attendance:view',
        'attendance:mark',
        'announcements:manage',
        'announcements:view',
        'performance:view',
        'performance:manage',
        'leaderboard:view',
    ],
    INTERN: [
        'tasks:view',
        'chat:view',
        'chat:send',
        'dashboard:view',
        'projects:view',
        'attendance:mark',
        'announcements:view',
        'performance:view',
        'leaderboard:view',
    ],
};
export function hasPermission(role, permission) {
    const normalized = normalizeRole(role);
    return (rolePermissions[normalized] || []).includes(permission);
}
export function hasAnyRole(role, roles) {
    const normalizedRole = normalizeRole(role);
    return roles.map((item) => normalizeRole(item)).includes(normalizedRole);
}
export function roleLabel(role) {
    const normalized = normalizeRole(role) || '';
    return normalized.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}
export function extractErrorMessage(error) {
    if (error instanceof AuthorizationError)
        return error.message;
    if (error instanceof Error)
        return error.message;
    return 'Something went wrong';
}
export class AuthorizationError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = 'AuthorizationError';
        this.status = 403;
    }
}

