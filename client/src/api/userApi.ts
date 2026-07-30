import { apiSlice } from "../store/apiSlice";
import type { DesignationGrade, ManagedUser } from "../types";

export interface CreateUserBody {
  employee_id: string;
  username: string;
  password: string;
  full_name: string;
  hrms_id?: string;
  designation?: string;
  designation_grade?: DesignationGrade;
  card_signing_authority?: boolean;
  email?: string;
  mobile?: string;
  role_id: number;
  division_id?: number;
  zone_id?: number;
  station_id?: number;
  signature?: File;
}

function toFormData(data: CreateUserBody): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File) formData.append(key, value);
    else formData.append(key, String(value));
  });
  return formData;
}

export const userApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<ManagedUser[], void>({
      query: () => "/users",
      providesTags: (result) =>
        result
          ? [
              { type: "User" as const, id: "LIST" },
              ...result.map((u) => ({ type: "User" as const, id: u.id })),
            ]
          : [{ type: "User" as const, id: "LIST" }],
    }),
    createUser: builder.mutation<{ id: number }, CreateUserBody>({
      query: (data) => ({ url: "/users", method: "POST", body: toFormData(data) }),
      invalidatesTags: [{ type: "User" as const, id: "LIST" }],
    }),
    toggleUserStatus: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/users/${id}/toggle`, method: "PATCH" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "User" as const, id: "LIST" },
        { type: "User" as const, id },
      ],
    }),
  }),
});

export const { useGetUsersQuery, useCreateUserMutation, useToggleUserStatusMutation } = userApi;
