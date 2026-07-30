import { apiSlice } from "../store/apiSlice";
import type { Penalty, PenaltyApprovalStatus, PenaltyMetrics, PenaltyRecoveryStatus } from "../types";

export interface PenaltyFilters {
  search?: string;
  division_id?: number;
  contractor_id?: number;
  vendor_id?: number;
  approval_status?: PenaltyApprovalStatus;
  recovery_status?: PenaltyRecoveryStatus;
  penalty_date_from?: string;
  penalty_date_to?: string;
  due_date_from?: string;
  due_date_to?: string;
  limit?: number;
  offset?: number;
}

export interface PenaltyListResult {
  total: number;
  rows: Penalty[];
}

export interface CreatePenaltyBody {
  reference_type?: "complaint" | "inspection";
  complaint_id?: number;
  inspection_id?: number;
  contractor_id: number;
  vendor_id?: number;
  unit_id?: number;
  amount: number;
  reason: string;
  due_date?: string;
  issued_date?: string;
}

export interface UpdatePenaltyBody {
  amount?: number;
  reason?: string;
  due_date?: string;
  remarks?: string;
}

export interface UpdateRecoveryBody {
  recovery_status: PenaltyRecoveryStatus;
  recovery_amount?: number;
  recovery_date?: string;
  mr_number?: string;
  mr_date?: string;
  order_number?: string;
  order_date?: string;
  remarks?: string;
}

export interface PenaltyNotificationRow {
  id: number;
  penalty_code: string;
  amount: number;
  due_date?: string | null;
  recovery_date?: string | null;
  contractor_name: string | null;
}

export interface PenaltyNotifications {
  upcoming: PenaltyNotificationRow[];
  overdue: PenaltyNotificationRow[];
  recovered: PenaltyNotificationRow[];
}

function buildQuery(filters: PenaltyFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const penaltyApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPenalties: builder.query<PenaltyListResult, PenaltyFilters>({
      query: (filters) => `/penalties${buildQuery(filters)}`,
      providesTags: (result) =>
        result
          ? [
              { type: "Penalty" as const, id: "LIST" },
              ...result.rows.map((p) => ({ type: "Penalty" as const, id: p.id })),
            ]
          : [{ type: "Penalty" as const, id: "LIST" }],
    }),
    getPenaltyById: builder.query<Penalty, number>({
      query: (id) => `/penalties/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Penalty" as const, id }],
    }),
    getPenaltyMetrics: builder.query<PenaltyMetrics, void>({
      query: () => "/penalties/metrics",
      providesTags: [{ type: "Penalty" as const, id: "METRICS" }],
    }),
    getPenaltyNotifications: builder.query<PenaltyNotifications, void>({
      query: () => "/penalties/notifications",
      providesTags: [{ type: "Penalty" as const, id: "NOTIFICATIONS" }],
    }),
    createPenalty: builder.mutation<{ id: number; penalty_code: string }, CreatePenaltyBody>({
      query: (body) => ({ url: "/penalties", method: "POST", body }),
      invalidatesTags: [
        { type: "Penalty" as const, id: "LIST" },
        { type: "Penalty" as const, id: "METRICS" },
      ],
    }),
    editPenalty: builder.mutation<Penalty, { id: number; data: UpdatePenaltyBody }>({
      query: ({ id, data }) => ({ url: `/penalties/${id}`, method: "PATCH", body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Penalty" as const, id: "LIST" },
        { type: "Penalty" as const, id },
      ],
    }),
    approvePenalty: builder.mutation<Penalty, number>({
      query: (id) => ({ url: `/penalties/${id}/approve`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Penalty" as const, id: "LIST" },
        { type: "Penalty" as const, id: "METRICS" },
        { type: "Penalty" as const, id },
      ],
    }),
    rejectPenalty: builder.mutation<Penalty, { id: number; reason?: string }>({
      query: ({ id, reason }) => ({ url: `/penalties/${id}/reject`, method: "POST", body: { reason } }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Penalty" as const, id: "LIST" },
        { type: "Penalty" as const, id: "METRICS" },
        { type: "Penalty" as const, id },
      ],
    }),
    revokePenalty: builder.mutation<Penalty, { id: number; reason: string }>({
      query: ({ id, reason }) => ({ url: `/penalties/${id}/revoke`, method: "POST", body: { reason } }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Penalty" as const, id: "LIST" },
        { type: "Penalty" as const, id: "METRICS" },
        { type: "Penalty" as const, id },
      ],
    }),
    updatePenaltyRecovery: builder.mutation<Penalty, { id: number; data: UpdateRecoveryBody }>({
      query: ({ id, data }) => ({ url: `/penalties/${id}/recovery`, method: "PATCH", body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Penalty" as const, id: "LIST" },
        { type: "Penalty" as const, id: "METRICS" },
        { type: "Penalty" as const, id },
      ],
    }),
    uploadPenaltyDocument: builder.mutation<unknown, { id: number; file: File }>({
      query: ({ id, file }) => {
        const formData = new FormData();
        formData.append("document", file);
        return { url: `/penalties/${id}/documents`, method: "POST", body: formData };
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: "Penalty" as const, id }],
    }),
  }),
});

export const {
  useGetPenaltiesQuery,
  useLazyGetPenaltiesQuery,
  useGetPenaltyByIdQuery,
  useGetPenaltyMetricsQuery,
  useGetPenaltyNotificationsQuery,
  useCreatePenaltyMutation,
  useEditPenaltyMutation,
  useApprovePenaltyMutation,
  useRejectPenaltyMutation,
  useRevokePenaltyMutation,
  useUpdatePenaltyRecoveryMutation,
  useUploadPenaltyDocumentMutation,
} = penaltyApi;
