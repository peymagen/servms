import { apiSlice, API_BASE } from "../store/apiSlice";
import type { Inspection, InspectionAssignment, InspectionAtr, DropdownOption } from "../types";

export interface InspectionFilters {
  search?: string;
  inspection_no?: string;
  division_id?: number;
  unit_id?: number;
  station_id?: number;
  train_id?: number;
  inspector_id?: number;
  assigned_to_user_id?: number;
  inspection_category_id?: number;
  inspection_type_id?: number;
  status?: string;
  priority?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface InspectionListResult {
  total: number;
  rows: Inspection[];
}

export interface InspectionMetrics {
  total: number;
  pending: number;
  assigned: number;
  atrPending: number;
  underReview: number;
  approved: number;
  rejected: number;
  closed: number;
  divisionWise: Array<{ division_name: string | null; count: number }>;
  unitWise: Array<{ unit_name: string | null; count: number }>;
  categoryWise: Array<{ inspection_category: string | null; count: number }>;
  statusWise: Array<{ inspection_status: string; count: number }>;
  inspectorWise: Array<{ inspector_name: string | null; count: number }>;
  monthlyTrend: Array<{ month: string; count: number }>;
}

export interface CreateInspectionBody {
  unit_id: number;
  division_id?: number;
  station_id?: number;
  train_id?: number;
  inspecting_official_name?: string;
  designation?: string;
  place_of_posting?: string;
  inspection_category_id: number;
  inspection_type_id: number;
  inspection_date: string;
  observations?: string;
  deficiencies?: string;
  recommendations?: string;
  remarks?: string;
  priority?: Inspection["priority"];
  documents?: File[];
}

export type UpdateInspectionBody = Partial<Omit<CreateInspectionBody, "documents">> & { documents?: File[] };

export interface AssignInspectionBody {
  to_unit_id: number;
  assigned_to_user_id?: number;
  remarks?: string;
}

export interface AtrDraftBody {
  action_description: string;
  action_date?: string;
  completion_status?: InspectionAtr["completion_status"];
  remarks?: string;
  documents?: File[];
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function toFormData(data: object, fileFields: string[] = ["documents"]): FormData {
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

export async function downloadInspectionsReport(filters: InspectionFilters, format: "xlsx" | "csv") {
  const token = localStorage.getItem("servms_token");
  const res = await fetch(`${API_BASE}/inspections/export${buildQuery({ ...filters, format })}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error("Unable to export inspections report");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inspections-report.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export const inspectionApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getInspections: builder.query<InspectionListResult, InspectionFilters>({
      query: (filters) => `/inspections${buildQuery(filters)}`,
      providesTags: (result) =>
        result
          ? [
              { type: "Inspection" as const, id: "LIST" },
              ...result.rows.map((i) => ({ type: "Inspection" as const, id: i.id })),
            ]
          : [{ type: "Inspection" as const, id: "LIST" }],
    }),
    getInspectionById: builder.query<Inspection, number>({
      query: (id) => `/inspections/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Inspection" as const, id }],
    }),
    getInspectionMetrics: builder.query<InspectionMetrics, void>({
      query: () => "/inspections/metrics",
      providesTags: [{ type: "Inspection" as const, id: "METRICS" }],
    }),
    createInspection: builder.mutation<{ id: number; inspection_no: string }, CreateInspectionBody>({
      query: (data) => ({ url: "/inspections", method: "POST", body: toFormData(data) }),
      invalidatesTags: [
        { type: "Inspection" as const, id: "LIST" },
        { type: "Inspection" as const, id: "METRICS" },
      ],
    }),
    editInspection: builder.mutation<unknown, { id: number; data: UpdateInspectionBody }>({
      query: ({ id, data }) => ({ url: `/inspections/${id}`, method: "PATCH", body: toFormData(data) }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inspection" as const, id: "LIST" },
        { type: "Inspection" as const, id },
        { type: "Inspection" as const, id: "METRICS" },
      ],
    }),
    deleteInspection: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/inspections/${id}`, method: "DELETE" }),
      invalidatesTags: [
        { type: "Inspection" as const, id: "LIST" },
        { type: "Inspection" as const, id: "METRICS" },
      ],
    }),
    submitInspection: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/inspections/${id}/submit`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Inspection" as const, id },
        { type: "Inspection" as const, id: "LIST" },
        { type: "Inspection" as const, id: "METRICS" },
      ],
    }),
    returnToInspector: builder.mutation<unknown, { id: number; remarks?: string }>({
      query: ({ id, remarks }) => ({ url: `/inspections/${id}/return`, method: "POST", body: { remarks } }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inspection" as const, id },
        { type: "Inspection" as const, id: "LIST" },
        { type: "Inspection" as const, id: "METRICS" },
      ],
    }),
    closeInspection: builder.mutation<unknown, { id: number; remarks?: string }>({
      query: ({ id, remarks }) => ({ url: `/inspections/${id}/close`, method: "POST", body: { remarks } }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inspection" as const, id },
        { type: "Inspection" as const, id: "LIST" },
        { type: "Inspection" as const, id: "METRICS" },
      ],
    }),
    deleteInspectionDocument: builder.mutation<unknown, { documentId: number; inspectionId: number }>({
      query: ({ documentId }) => ({ url: `/inspections/documents/${documentId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { inspectionId }) => [{ type: "Inspection" as const, id: inspectionId }],
    }),

    // ── Assignment ──
    getAssignmentHistory: builder.query<InspectionAssignment[], number>({
      query: (id) => `/inspections/${id}/assignments`,
      providesTags: (_result, _error, id) => [{ type: "Inspection" as const, id: `assignments-${id}` }],
    }),
    assignInspection: builder.mutation<unknown, { id: number; data: AssignInspectionBody }>({
      query: ({ id, data }) => ({ url: `/inspections/${id}/assign`, method: "POST", body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inspection" as const, id },
        { type: "Inspection" as const, id: "LIST" },
        { type: "Inspection" as const, id: `assignments-${id}` },
      ],
    }),
    reassignInspection: builder.mutation<unknown, { id: number; data: AssignInspectionBody }>({
      query: ({ id, data }) => ({ url: `/inspections/${id}/reassign`, method: "POST", body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inspection" as const, id },
        { type: "Inspection" as const, id: "LIST" },
        { type: "Inspection" as const, id: `assignments-${id}` },
      ],
    }),
    transferInspection: builder.mutation<unknown, { id: number; data: AssignInspectionBody }>({
      query: ({ id, data }) => ({ url: `/inspections/${id}/transfer`, method: "POST", body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inspection" as const, id },
        { type: "Inspection" as const, id: "LIST" },
        { type: "Inspection" as const, id: `assignments-${id}` },
      ],
    }),

    // ── Action Taken Report workflow ──
    getAtrsForInspection: builder.query<InspectionAtr[], number>({
      query: (id) => `/inspections/${id}/atr`,
      providesTags: (_result, _error, id) => [{ type: "Inspection" as const, id: `atr-${id}` }],
    }),
    createAtrDraft: builder.mutation<{ id: number }, { id: number } & AtrDraftBody>({
      query: ({ id, ...data }) => ({ url: `/inspections/${id}/atr`, method: "POST", body: toFormData(data) }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inspection" as const, id },
        { type: "Inspection" as const, id: `atr-${id}` },
      ],
    }),
    editAtr: builder.mutation<unknown, { id: number; atrId: number } & AtrDraftBody>({
      query: ({ id, atrId, ...data }) => ({ url: `/inspections/${id}/atr/${atrId}`, method: "PATCH", body: toFormData(data) }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inspection" as const, id },
        { type: "Inspection" as const, id: `atr-${id}` },
      ],
    }),
    submitAtr: builder.mutation<unknown, { id: number; atrId: number }>({
      query: ({ id, atrId }) => ({ url: `/inspections/${id}/atr/${atrId}/submit`, method: "POST" }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inspection" as const, id },
        { type: "Inspection" as const, id: "LIST" },
        { type: "Inspection" as const, id: `atr-${id}` },
      ],
    }),
    reviewAtr: builder.mutation<unknown, { id: number; atrId: number; decision: "forward" | "send_back"; remarks?: string }>({
      query: ({ id, atrId, decision, remarks }) => ({
        url: `/inspections/${id}/atr/${atrId}/review`,
        method: "POST",
        body: { decision, remarks },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inspection" as const, id },
        { type: "Inspection" as const, id: "LIST" },
        { type: "Inspection" as const, id: `atr-${id}` },
      ],
    }),
    decideAtr: builder.mutation<
      unknown,
      { id: number; atrId: number; decision: "accepted" | "rejected" | "sent_back"; remarks?: string }
    >({
      query: ({ id, atrId, decision, remarks }) => ({
        url: `/inspections/${id}/atr/${atrId}/decide`,
        method: "POST",
        body: { decision, remarks },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Inspection" as const, id },
        { type: "Inspection" as const, id: "LIST" },
        { type: "Inspection" as const, id: "METRICS" },
        { type: "Inspection" as const, id: `atr-${id}` },
      ],
    }),

    // ── Inspection Category / Type master ──
    getInspectionCategories: builder.query<DropdownOption[], { includeInactive?: boolean } | void>({
      query: (args) => `/inspections/categories${args?.includeInactive ? "?include_inactive=1" : ""}`,
      providesTags: [{ type: "InspectionType" as const, id: "CATEGORIES" }],
    }),
    getInspectionTypes: builder.query<DropdownOption[], { categoryId: number; includeInactive?: boolean }>({
      query: ({ categoryId, includeInactive }) =>
        `/inspections/types?category_id=${categoryId}${includeInactive ? "&include_inactive=1" : ""}`,
      providesTags: (_result, _error, { categoryId }) => [{ type: "InspectionType" as const, id: `types-${categoryId}` }],
    }),
    createInspectionCategory: builder.mutation<{ id: number }, { value: string; label: string; sort_order?: number }>({
      query: (data) => ({ url: "/inspections/categories", method: "POST", body: data }),
      invalidatesTags: [{ type: "InspectionType" as const, id: "CATEGORIES" }],
    }),
    createInspectionType: builder.mutation<
      { id: number },
      { parent_id: number; value: string; label: string; sort_order?: number }
    >({
      query: (data) => ({ url: "/inspections/types", method: "POST", body: data }),
      invalidatesTags: (_result, _error, { parent_id }) => [{ type: "InspectionType" as const, id: `types-${parent_id}` }],
    }),
    editInspectionTypeOption: builder.mutation<
      unknown,
      { id: number; isType: boolean; parentId?: number; label?: string; sort_order?: number }
    >({
      query: ({ id, isType, label, sort_order }) => ({
        url: `/inspections/${isType ? "types" : "categories"}/${id}`,
        method: "PATCH",
        body: { label, sort_order },
      }),
      invalidatesTags: (_result, _error, { isType, parentId }) => [
        isType ? { type: "InspectionType" as const, id: `types-${parentId}` } : { type: "InspectionType" as const, id: "CATEGORIES" },
      ],
    }),
    deleteInspectionTypeOption: builder.mutation<unknown, { id: number; isType: boolean; parentId?: number }>({
      query: ({ id, isType }) => ({ url: `/inspections/${isType ? "types" : "categories"}/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { isType, parentId }) => [
        isType ? { type: "InspectionType" as const, id: `types-${parentId}` } : { type: "InspectionType" as const, id: "CATEGORIES" },
      ],
    }),
    activateInspectionTypeOption: builder.mutation<unknown, { id: number; isType: boolean; parentId?: number }>({
      query: ({ id, isType }) => ({ url: `/inspections/${isType ? "types" : "categories"}/${id}/activate`, method: "POST" }),
      invalidatesTags: (_result, _error, { isType, parentId }) => [
        isType ? { type: "InspectionType" as const, id: `types-${parentId}` } : { type: "InspectionType" as const, id: "CATEGORIES" },
      ],
    }),
  }),
});

export const {
  useGetInspectionsQuery,
  useGetInspectionByIdQuery,
  useGetInspectionMetricsQuery,
  useCreateInspectionMutation,
  useEditInspectionMutation,
  useDeleteInspectionMutation,
  useSubmitInspectionMutation,
  useReturnToInspectorMutation,
  useCloseInspectionMutation,
  useDeleteInspectionDocumentMutation,
  useGetAssignmentHistoryQuery,
  useAssignInspectionMutation,
  useReassignInspectionMutation,
  useTransferInspectionMutation,
  useGetAtrsForInspectionQuery,
  useCreateAtrDraftMutation,
  useEditAtrMutation,
  useSubmitAtrMutation,
  useReviewAtrMutation,
  useDecideAtrMutation,
  useGetInspectionCategoriesQuery,
  useGetInspectionTypesQuery,
  useCreateInspectionCategoryMutation,
  useCreateInspectionTypeMutation,
  useEditInspectionTypeOptionMutation,
  useDeleteInspectionTypeOptionMutation,
  useActivateInspectionTypeOptionMutation,
} = inspectionApi;
