import { apiSlice } from "../store/apiSlice";
import type { Role, RolePermission } from "../types";

export interface CreateRoleBody {
  role_name: string;
  description?: string;
}

export interface UpdateRoleBody {
  description?: string;
  roles_status?: Role["roles_status"];
}

export interface PermissionUpdate {
  module_name: RolePermission["module_name"];
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve_reject: boolean;
  can_export: boolean;
}

export const roleApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRoles: builder.query<Role[], void>({
      query: () => "/roles",
      providesTags: (result) =>
        result
          ? [
              { type: "Role" as const, id: "LIST" },
              ...result.map((r) => ({ type: "Role" as const, id: r.id })),
            ]
          : [{ type: "Role" as const, id: "LIST" }],
    }),
    createRole: builder.mutation<{ id: number }, CreateRoleBody>({
      query: (body) => ({ url: "/roles", method: "POST", body }),
      invalidatesTags: [{ type: "Role" as const, id: "LIST" }],
    }),
    editRole: builder.mutation<Role, { id: number; data: UpdateRoleBody }>({
      query: ({ id, data }) => ({ url: `/roles/${id}`, method: "PATCH", body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Role" as const, id: "LIST" },
        { type: "Role" as const, id },
      ],
    }),
    deleteRole: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/roles/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Role" as const, id: "LIST" }],
    }),
    // getRolePermissions is defined in authApi.ts (used by useAuth's `can()`) — reuse
    // useGetRolePermissionsQuery from there instead of redefining the same endpoint here.
    updateRolePermissions: builder.mutation<unknown, { roleId: number; permissions: PermissionUpdate[] }>({
      query: ({ roleId, permissions }) => ({
        url: `/roles/${roleId}/permissions`,
        method: "PATCH",
        body: { permissions },
      }),
      invalidatesTags: (_result, _error, { roleId }) => [{ type: "RolePermission" as const, id: roleId }],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useCreateRoleMutation,
  useEditRoleMutation,
  useDeleteRoleMutation,
  useUpdateRolePermissionsMutation,
} = roleApi;
