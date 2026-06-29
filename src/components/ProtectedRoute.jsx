import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
export function ProtectedRoute({ children, adminOnly = false, allowedRoles, requiredPermission, }) {
    const location = useLocation();
    const { isAuthenticated, isAuthReady, isAdmin, hasRole, can } = useAuth();
    if (!isAuthReady)
        return <div className="min-h-[40vh]" />;
    if (!isAuthenticated)
        return <Navigate to="/login" replace state={{ from: location }} />;
    if (adminOnly && !isAdmin)
        return <Navigate to="/unauthorized" replace state={{ from: location }} />;
    if (allowedRoles && !hasRole(allowedRoles))
        return <Navigate to="/unauthorized" replace state={{ from: location }} />;
    if (requiredPermission && !can(requiredPermission))
        return <Navigate to="/unauthorized" replace state={{ from: location }} />;
    return <>{children}</>;
}


