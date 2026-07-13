import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '@/services/api';
import { hasPermission, normalizeRole } from '@/lib/rbac';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [state, setState] = useState(() => {
        const stored = localStorage.getItem('taskflow_auth');
        const initialState = stored
            ? (() => { try {
                return JSON.parse(stored);
            }
            catch {
                return { user: null, token: null, isAuthenticated: false };
            } })()
            : { user: null, token: null, isAuthenticated: false };
        api.setActiveUserId(initialState.user?.id || null);
        return initialState;
    });
    useEffect(() => {
        if (state.isAuthenticated) {
            localStorage.setItem('taskflow_auth', JSON.stringify(state));
        }
        else {
            localStorage.removeItem('taskflow_auth');
        }
    }, [state]);
    useEffect(() => {
        let mounted = true;
        async function restore() {
            const result = await api.restoreSession();
            if (!mounted)
                return;
            if (result) {
                setState((previous) => ({
                    user: {
                        ...result.user,
                        avatarUrl: result.user?.avatarUrl || previous.user?.avatarUrl || null,
                    },
                    token: result.token,
                    isAuthenticated: true,
                }));
                api.setActiveUserId(result.user.id);
            }
            else {
                setState((previous) => previous.isAuthenticated
                    ? { user: null, token: null, isAuthenticated: false }
                    : previous);
                api.setActiveUserId(null);
            }
            setIsAuthReady(true);
        }
        restore();
        return () => {
            mounted = false;
        };
    }, []);
    const loginFn = useCallback(async (email, password) => {
        try {
            const result = await api.login(email, password);
            if (!result)
                return null;
            if (result.requiresApproval) {
                return result;
            }
            if (!result.user) {
                return result;
            }
            api.setActiveUserId(result.user.id);
            setState({ user: result.user, token: result.token, isAuthenticated: true });
            return result;
        } catch (err) {
            console.error('[AuthContext] Login error:', err);
            return null;
        }
    }, []);
    const registerFn = useCallback(async (name, email, password, role = 'INTERN') => {
        try {
            const result = await api.register(name, email, password, role);
            if (!result)
                return null;
            if (result.requiresApproval) {
                return result;
            }
            if (!result.user) {
                return result;
            }
            api.setActiveUserId(result.user.id);
            setState({ user: result.user, token: result.token, isAuthenticated: true });
            return result;
        } catch (err) {
            console.error('[AuthContext] Register error:', err);
            return null;
        }
    }, []);
    const logout = useCallback(async () => {
        await api.logout();
        setState({ user: null, token: null, isAuthenticated: false });
    }, []);
    const updateProfile = useCallback(async (data) => {
        if (!state.user)
            return false;
        let nextUserData = data;
        try {
            const persisted = await api.updateOwnProfile(data);
            if (persisted) {
                nextUserData = persisted;
            }
        }
        catch (err) {
            console.error('[AuthContext] Profile update error:', err);
        }
        setState((prev) => prev.user ? { ...prev, user: { ...prev.user, ...nextUserData } } : prev);
        return true;
    }, [state.user]);
    useEffect(() => {
        api.setActiveUserId(state.user?.id || null);
    }, [state.user?.id]);
    const role = normalizeRole(state.user?.role || null);
    const isAdmin = role === 'ADMIN';
    const hasRole = useCallback((roles) => {
        if (!role)
            return false;
        return Array.isArray(roles) ? roles.includes(role) : role === roles;
    }, [role]);
    const can = useCallback((permission) => {
        if (!role)
            return false;
        return hasPermission(role, permission);
    }, [role]);
        return (<AuthContext.Provider value={{ ...state, isAuthReady, login: loginFn, register: registerFn, logout, updateProfile, isAdmin, role, hasRole, can }}>
      {children}
    </AuthContext.Provider>);
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}


