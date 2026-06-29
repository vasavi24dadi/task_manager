import { describe, expect, it } from 'vitest';
import { hasPermission, normalizeRole, ROLES } from './rbac';

describe('rbac role normalization', () => {
  it('normalizes legacy manager roles to the current manager role', () => {
    expect(normalizeRole('PROJECT_MANAGER')).toBe(ROLES.MANAGER);
    expect(normalizeRole('TEAM_LEADER')).toBe(ROLES.MANAGER);
  });

  it('grants manager permissions for the main workspace actions', () => {
    expect(hasPermission(ROLES.MANAGER, 'projects:create')).toBe(true);
    expect(hasPermission(ROLES.MANAGER, 'tasks:create')).toBe(true);
    expect(hasPermission(ROLES.MANAGER, 'dashboard:view')).toBe(true);
  });
});
