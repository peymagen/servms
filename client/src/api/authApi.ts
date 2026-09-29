import { apiSlice } from "../store/apiSlice";
import type { AuthUser, RolePermission } from "../types";

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, { username: string; password: string }>({
      query: ({ username, password }) => ({
        url: "/users/login",
        method: "POST",
        body: { username, password },
      }),
    }),
    getMe: builder.query<AuthUser, void>({
      query: () => "/users/me",
    }),
    getRolePermissions: builder.query<RolePermission[], number>({
      query: (roleId) => `/roles/${roleId}/permissions`,
      providesTags: ["RolePermission"],
    }),
  }),
});

export const { useLoginMutation, useGetMeQuery, useGetRolePermissionsQuery } = authApi;
