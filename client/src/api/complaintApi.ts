import { apiSlice, API_BASE } from "../store/apiSlice";
import type { Complaint, ComplaintAssignment, ComplaintAtr, ComplaintImportHistory, DropdownOption } from "../types";

export interface ComplaintFilters {
  search?: string;
  complaint_ref_no?: string;
  complaint_source?: string;
  division_id?: number;
  unit_id?: number;
  station_id?: number;
  train_id?: number;
  complaint_type_id?: number;
  complaint_subtype_id?: number;
  status?: string;
  priority?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface ComplaintListResult {
  total: number;
  rows: Complaint[];
}

export interface ComplaintMetrics {
  total: number;
  pending: number;
  assigned: number;
  underReview: number;
  actionTaken: number;
  approved: number;
  rejected: number;
  closed: number;
  today: number;
  thisMonth: number;
  openComplaints: number;
  pendingATR: number;
  divisionWise: Array<{ division_name: string | null; count: number }>;
  typeWise: Array<{ complaint_type: string | null; count: number }>;
  statusWise: Array<{ complaints_status: string; count: number }>;
  monthlyTrend: Array<{ month: string; count: number }>;
}

export interface CreateComplaintBody {
  complaint_source?: "railmadad" | "cpgrams" | "manual";
  complaint_ref_no?: string;
  portal_registration_number?: string;
  manual_dak_reference_number?: string;
  eoffice_computer_number?: string;
  unit_id: number;
  division_id?: number;
  train_id?: number;
  station_id?: number;
  location_text?: string;
  complaint_type_id: number;
  complaint_subtype_id: number;
  description: string;
  complainant_name?: string;
  complainant_mobile?: string;
  complainant_email?: string;
  occurrence_date?: string;
  occurrence_time?: string;
  priority?: Complaint["priority"];
  evidence?: File[];
}

export interface UpdateComplaintBody {
  location_text?: string;
  complaint_type_id?: number;
  complaint_subtype_id?: number;
  description?: string;
  priority?: Complaint["priority"];
  complainant_name?: string;
  complainant_mobile?: string;
  complainant_email?: string;
}

export interface AssignComplaintBody {
  to_unit_id: number;
  assigned_to_user_id?: number;
  remarks?: string;
}

export interface ImportSummary {
  importId: number;
  totalRecords: number;
  importedCount: number;
  duplicateCount: number;
  failedCount: number;
  failed: Array<{ row: number; reason: string }>;
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function toFormData(data: object, fileFields: string[] = ["evidence", "documents"]): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (fileFields.includes(key) && Array.isArray(value)) {
      value.forEach((file) => formData.append(key, file as File));
    } else {
      formData.append(key, String(value));
    }
  });
  return formData;
}

// Excel/CSV export is a binary file response, not the {success,data} JSON
// envelope every other endpoint returns, so it's fetched directly rather than
// routed through RTK Query's envelope-unwrapping base query.
export async function downloadComplaintsReport(filters: ComplaintFilters, format: "xlsx" | "csv") {
  const token = localStorage.getItem("servms_token");
  const res = await fetch(`${API_BASE}/complaints/export${buildQuery({ ...filters, format })}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error("Unable to export complaints report");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `complaints-report.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export const complaintApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getComplaints: builder.query<ComplaintListResult, ComplaintFilters>({
      query: (filters) => `/complaints${buildQuery(filters)}`,
      providesTags: (result) =>
        result
          ? [
              { type: "Complaint" as const, id: "LIST" },
              ...result.rows.map((c) => ({ type: "Complaint" as const, id: c.id })),
            ]
          : [{ type: "Complaint" as const, id: "LIST" }],
    }),
    getComplaintById: builder.query<Complaint, number>({
      query: (id) => `/complaints/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Complaint" as const, id }],
    }),
    getComplaintMetrics: builder.query<ComplaintMetrics, void>({
      query: () => "/complaints/metrics",
      providesTags: [{ type: "Complaint" as const, id: "METRICS" }],
    }),
    createComplaint: builder.mutation<{ id: number; complaint_code: string }, CreateComplaintBody>({
      query: (data) => ({ url: "/complaints", method: "POST", body: toFormData(data) }),
      invalidatesTags: [
        { type: "Complaint" as const, id: "LIST" },
        { type: "Complaint" as const, id: "METRICS" },
      ],
    }),
    editComplaint: builder.mutation<Complaint, { id: number; data: UpdateComplaintBody }>({
      query: ({ id, data }) => ({ url: `/complaints/${id}`, method: "PATCH", body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Complaint" as const, id: "LIST" },
        { type: "Complaint" as const, id },
        { type: "Complaint" as const, id: "METRICS" },
      ],
    }),
    closeComplaint: builder.mutation<unknown, { id: number; remarks?: string }>({
      query: ({ id, remarks }) => ({ url: `/complaints/${id}/close`, method: "POST", body: { remarks } }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Complaint" as const, id: "LIST" },
        { type: "Complaint" as const, id },
        { type: "Complaint" as const, id: "METRICS" },
      ],
    }),

    // ── Assignment ──
    getAssignmentHistory: builder.query<ComplaintAssignment[], number>({
      query: (id) => `/complaints/${id}/assignments`,
      providesTags: (_result, _error, id) => [{ type: "Complaint" as const, id: `assignments-${id}` }],
    }),
    assignComplaint: builder.mutation<unknown, { id: number; data: AssignComplaintBody }>({
      query: ({ id, data }) => ({ url: `/complaints/${id}/assign`, method: "POST", body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Complaint" as const, id },
        { type: "Complaint" as const, id: "LIST" },
        { type: "Complaint" as const, id: `assignments-${id}` },
      ],
    }),
    reassignComplaint: builder.mutation<unknown, { id: number; data: AssignComplaintBody }>({
      query: ({ id, data }) => ({ url: `/complaints/${id}/reassign`, method: "POST", body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Complaint" as const, id },
        { type: "Complaint" as const, id: "LIST" },
        { type: "Complaint" as const, id: `assignments-${id}` },
      ],
    }),
    transferComplaint: builder.mutation<unknown, { id: number; data: AssignComplaintBody }>({
      query: ({ id, data }) => ({ url: `/complaints/${id}/transfer`, method: "POST", body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Complaint" as const, id },
        { type: "Complaint" as const, id: "LIST" },
        { type: "Complaint" as const, id: `assignments-${id}` },
      ],
    }),

    // ── Action Taken Report workflow ──
    getAtrsForComplaint: builder.query<ComplaintAtr[], number>({
      query: (id) => `/complaints/${id}/atr`,
      providesTags: (_result, _error, id) => [{ type: "Complaint" as const, id: `atr-${id}` }],
    }),
    submitAtr: builder.mutation<{ id: number }, { id: number; remarks: string; documents?: File[] }>({
      query: ({ id, ...data }) => ({ url: `/complaints/${id}/atr`, method: "POST", body: toFormData(data) }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Complaint" as const, id },
        { type: "Complaint" as const, id: "LIST" },
        { type: "Complaint" as const, id: `atr-${id}` },
      ],
    }),
    editAtr: builder.mutation<unknown, { id: number; atrId: number; remarks: string; documents?: File[] }>({
      query: ({ id, atrId, ...data }) => ({ url: `/complaints/${id}/atr/${atrId}`, method: "PATCH", body: toFormData(data) }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Complaint" as const, id },
        { type: "Complaint" as const, id: `atr-${id}` },
      ],
    }),
    reviewAtr: builder.mutation<unknown, { id: number; atrId: number; remarks?: string }>({
      query: ({ id, atrId, remarks }) => ({ url: `/complaints/${id}/atr/${atrId}/review`, method: "POST", body: { remarks } }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Complaint" as const, id },
        { type: "Complaint" as const, id: "LIST" },
        { type: "Complaint" as const, id: `atr-${id}` },
      ],
    }),
    decideAtr: builder.mutation<
      unknown,
      { id: number; atrId: number; decision: "accepted" | "rejected" | "sent_back"; remarks?: string }
    >({
      query: ({ id, atrId, decision, remarks }) => ({
        url: `/complaints/${id}/atr/${atrId}/decide`,
        method: "POST",
        body: { decision, remarks },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Complaint" as const, id },
        { type: "Complaint" as const, id: "LIST" },
        { type: "Complaint" as const, id: "METRICS" },
        { type: "Complaint" as const, id: `atr-${id}` },
      ],
    }),

    // ── RailMadad Excel import ──
    importRailMadad: builder.mutation<ImportSummary, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return { url: "/complaints/import", method: "POST", body: formData };
      },
      invalidatesTags: [
        { type: "Complaint" as const, id: "LIST" },
        { type: "Complaint" as const, id: "METRICS" },
        { type: "ComplaintImport" as const, id: "LIST" },
      ],
    }),
    getImportHistory: builder.query<ComplaintImportHistory[], void>({
      query: () => "/complaints/import/history",
      providesTags: [{ type: "ComplaintImport" as const, id: "LIST" }],
    }),
    deleteImportHistory: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/complaints/import/history/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "ComplaintImport" as const, id: "LIST" }],
    }),

    // ── Complaint Type / Sub-type master ──
    getComplaintTypes: builder.query<DropdownOption[], { includeInactive?: boolean } | void>({
      query: (args) => `/complaints/types${args?.includeInactive ? "?include_inactive=1" : ""}`,
      providesTags: [{ type: "ComplaintType" as const, id: "TYPES" }],
    }),
    getComplaintSubtypes: builder.query<DropdownOption[], { typeId: number; includeInactive?: boolean }>({
      query: ({ typeId, includeInactive }) => `/complaints/subtypes?type_id=${typeId}${includeInactive ? "&include_inactive=1" : ""}`,
      providesTags: (_result, _error, { typeId }) => [{ type: "ComplaintType" as const, id: `subtypes-${typeId}` }],
    }),
    createComplaintType: builder.mutation<{ id: number }, { value: string; label: string; sort_order?: number }>({
      query: (data) => ({ url: "/complaints/types", method: "POST", body: data }),
      invalidatesTags: [{ type: "ComplaintType" as const, id: "TYPES" }],
    }),
    createComplaintSubtype: builder.mutation<
      { id: number },
      { parent_id: number; value: string; label: string; sort_order?: number }
    >({
      query: (data) => ({ url: "/complaints/subtypes", method: "POST", body: data }),
      invalidatesTags: (_result, _error, { parent_id }) => [{ type: "ComplaintType" as const, id: `subtypes-${parent_id}` }],
    }),
    editComplaintTypeOption: builder.mutation<unknown, { id: number; isSubtype: boolean; parentId?: number; label?: string; sort_order?: number }>({
      query: ({ id, isSubtype, label, sort_order }) => ({
        url: `/complaints/${isSubtype ? "subtypes" : "types"}/${id}`,
        method: "PATCH",
        body: { label, sort_order },
      }),
      invalidatesTags: (_result, _error, { isSubtype, parentId }) => [
        isSubtype ? { type: "ComplaintType" as const, id: `subtypes-${parentId}` } : { type: "ComplaintType" as const, id: "TYPES" },
      ],
    }),
    deleteComplaintTypeOption: builder.mutation<unknown, { id: number; isSubtype: boolean; parentId?: number }>({
      query: ({ id, isSubtype }) => ({ url: `/complaints/${isSubtype ? "subtypes" : "types"}/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { isSubtype, parentId }) => [
        isSubtype ? { type: "ComplaintType" as const, id: `subtypes-${parentId}` } : { type: "ComplaintType" as const, id: "TYPES" },
      ],
    }),
    activateComplaintTypeOption: builder.mutation<unknown, { id: number; isSubtype: boolean; parentId?: number }>({
      query: ({ id, isSubtype }) => ({ url: `/complaints/${isSubtype ? "subtypes" : "types"}/${id}/activate`, method: "POST" }),
      invalidatesTags: (_result, _error, { isSubtype, parentId }) => [
        isSubtype ? { type: "ComplaintType" as const, id: `subtypes-${parentId}` } : { type: "ComplaintType" as const, id: "TYPES" },
      ],
    }),
  }),
});

export const {
  useGetComplaintsQuery,
  useGetComplaintByIdQuery,
  useGetComplaintMetricsQuery,
  useCreateComplaintMutation,
  useEditComplaintMutation,
  useCloseComplaintMutation,
  useGetAssignmentHistoryQuery,
  useAssignComplaintMutation,
  useReassignComplaintMutation,
  useTransferComplaintMutation,
  useGetAtrsForComplaintQuery,
  useSubmitAtrMutation,
  useEditAtrMutation,
  useReviewAtrMutation,
  useDecideAtrMutation,
  useImportRailMadadMutation,
  useGetImportHistoryQuery,
  useDeleteImportHistoryMutation,
  useGetComplaintTypesQuery,
  useGetComplaintSubtypesQuery,
  useCreateComplaintTypeMutation,
  useCreateComplaintSubtypeMutation,
  useEditComplaintTypeOptionMutation,
  useDeleteComplaintTypeOptionMutation,
  useActivateComplaintTypeOptionMutation,
} = complaintApi;
