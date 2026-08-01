import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { ModuleName, PermissionAction } from "../../types";

interface ProtectedRouteProps {
  children: ReactNode;
  // Previously this component only checked "is logged in" — every route was
  // reachable by any authenticated role simply by typing the URL, regardless
  // of role_permissions (the backend still rejected the underlying API calls,
  // but page shells/menus could render first). Passing `module` now redirects
  // a role that lacks it before the page ever mounts.
  module?: ModuleName;
  action?: PermissionAction;
}

export default function ProtectedRoute({ children, module, action = "view" }: ProtectedRouteProps) {
  const { user, isLoading, can } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (module && !can(module, action)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
