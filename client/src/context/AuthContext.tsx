import { useCallback, useEffect, type ReactNode } from "react";
import type { ModuleName, PermissionAction, RolePermission } from "../types";
import { useLoginMutation, useGetMeQuery, useGetRolePermissionsQuery } from "../api/authApi";
import { sessionEstablished, sessionUserRefreshed, sessionCleared } from "../store/authSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { isDivisionScopedRole } from "../types/labels";

const PERMISSION_COLUMN: Record<PermissionAction, keyof RolePermission> = {
  view: "can_view",
  create: "can_create",
  edit: "can_edit",
  delete: "can_delete",
  approve_reject: "can_approve_reject",
  export: "can_export",
};

// Session state now lives in the Redux `auth` slice (see store/authSlice.ts) and permissions
// are fetched via RTK Query — this wrapper is kept only so App.tsx's <AuthProvider> doesn't
// need to change; it no longer holds any state of its own.
export function AuthProvider({ children }: { children: ReactNode }) {
  // The stored user is a login-time snapshot; refresh it from the server so a
  // division or role assigned after login (e.g. a Dealing Section's division)
  // shows up without logging out and back in.
  const dispatch = useAppDispatch();
  const loggedIn = useAppSelector((state) => !!state.auth.user);
  const { data: me } = useGetMeQuery(undefined, { skip: !loggedIn });
  useEffect(() => {
    if (me) dispatch(sessionUserRefreshed(me));
  }, [me, dispatch]);
  return <>{children}</>;
}

export function useAuth() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [loginMutation] = useLoginMutation();
  const { data: permissions = [] } = useGetRolePermissionsQuery(user?.role_id ?? 0, {
    skip: !user,
  });

  const login = useCallback(
    async (username: string, password: string) => {
      const { accessToken, user: loggedInUser } = await loginMutation({ username, password }).unwrap();
      dispatch(sessionEstablished({ accessToken, user: loggedInUser }));
    },
    [dispatch, loginMutation]
  );

  const logout = useCallback(() => {
    dispatch(sessionCleared());
  }, [dispatch]);

  // Super Admin HQ bypasses the permission matrix entirely, mirroring the server-side rule.
  const can = useCallback(
    (module: ModuleName, action: PermissionAction) => {
      if (!user) return false;
      if (user.role_name === "super_admin_hq") return true;
      const perm = permissions.find((p) => p.module_name === module);
      return !!perm && Boolean(perm[PERMISSION_COLUMN[action]]);
    },
    [user, permissions]
  );

  return { user, isLoading: false, login, logout, can };
}

// Divisional users always enter data into their own division: forms start on it and
// lock the Division picker (the server pins it regardless). HQ users choose freely.
export function useDivisionLock(): { locked: boolean; ownDivisionId: number | "" } {
  const user = useAppSelector((state) => state.auth.user);
  const locked = isDivisionScopedRole(user?.role_name);
  return { locked, ownDivisionId: locked ? user?.division_id ?? "" : "" };
}
