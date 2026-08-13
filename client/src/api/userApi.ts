import { apiSlice } from "../store/apiSlice";
import type { DesignationGrade, ManagedUser, PasswordResetRequest, UserTransferRequest } from "../types";

export interface CreateUserBody {
  employee_id: string;
  username: string;
  password: string;
  full_name: string;
  hrms_id?: string;
  designation?: string;
  designation_grade?: DesignationGrade;
  card_signing_authority?: boolean;
  card_signing_authority_designation?: string;
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

    raisePasswordResetRequest: builder.mutation<{ id: number }, { requested_user_id?: number; reason?: string }>({
      query: (body) => ({ url: "/users/password-reset-requests", method: "POST", body }),
      invalidatesTags: [{ type: "User" as const, id: "PASSWORD_RESET_REQUESTS" }],
    }),
    getPasswordResetRequests: builder.query<PasswordResetRequest[], { approval_status?: string } | void>({
      query: (filters) =>
        `/users/password-reset-requests${filters?.approval_status ? `?approval_status=${filters.approval_status}` : ""}`,
      providesTags: [{ type: "User" as const, id: "PASSWORD_RESET_REQUESTS" }],
    }),
    approvePasswordResetRequest: builder.mutation<{ temp_password: string }, { id: number; remarks?: string }>({
      query: ({ id, remarks }) => ({ url: `/users/password-reset-requests/${id}/approve`, method: "POST", body: { remarks } }),
      invalidatesTags: [{ type: "User" as const, id: "PASSWORD_RESET_REQUESTS" }, { type: "User" as const, id: "LIST" }],
    }),
    rejectPasswordResetRequest: builder.mutation<unknown, { id: number; remarks?: string }>({
      query: ({ id, remarks }) => ({ url: `/users/password-reset-requests/${id}/reject`, method: "POST", body: { remarks } }),
      invalidatesTags: [{ type: "User" as const, id: "PASSWORD_RESET_REQUESTS" }],
    }),

    raiseTransferRequest: builder.mutation<
      { id: number },
      { user_id: number; to_division_id?: number; to_role_id?: number; reason?: string }
    >({
      query: (body) => ({ url: "/users/transfer-requests", method: "POST", body }),
      invalidatesTags: [{ type: "User" as const, id: "TRANSFER_REQUESTS" }],
    }),
    getTransferRequests: builder.query<UserTransferRequest[], { approval_status?: string } | void>({
      query: (filters) =>
        `/users/transfer-requests${filters?.approval_status ? `?approval_status=${filters.approval_status}` : ""}`,
      providesTags: [{ type: "User" as const, id: "TRANSFER_REQUESTS" }],
    }),
    approveTransferRequest: builder.mutation<unknown, { id: number; remarks?: string }>({
      query: ({ id, remarks }) => ({ url: `/users/transfer-requests/${id}/approve`, method: "POST", body: { remarks } }),
      invalidatesTags: [{ type: "User" as const, id: "TRANSFER_REQUESTS" }, { type: "User" as const, id: "LIST" }],
    }),
    rejectTransferRequest: builder.mutation<unknown, { id: number; remarks?: string }>({
      query: ({ id, remarks }) => ({ url: `/users/transfer-requests/${id}/reject`, method: "POST", body: { remarks } }),
      invalidatesTags: [{ type: "User" as const, id: "TRANSFER_REQUESTS" }],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useToggleUserStatusMutation,
  useRaisePasswordResetRequestMutation,
  useGetPasswordResetRequestsQuery,
  useApprovePasswordResetRequestMutation,
  useRejectPasswordResetRequestMutation,
  useRaiseTransferRequestMutation,
  useGetTransferRequestsQuery,
  useApproveTransferRequestMutation,
  useRejectTransferRequestMutation,
} = userApi;
