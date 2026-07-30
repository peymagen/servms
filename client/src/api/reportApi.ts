import { apiSlice, API_BASE } from "../store/apiSlice";
import type {
  ReportModuleMeta,
  ReportTemplate,
  ReportFilter,
  ReportSort,
  ReportExportEntry,
  ImportableMaster,
  ReportImportHistoryEntry,
} from "../types";

export interface GenerateReportBody {
  module_key: string;
  fields: string[];
  filters?: ReportFilter[];
  sort?: ReportSort;
  group_by?: string[];
  aggregate_field?: string;
  limit?: number;
  offset?: number;
}

export interface GenerateReportResult {
  rows: Record<string, unknown>[];
  total: number;
  grouped: boolean;
}

export interface ReportDashboardMetrics {
  totalTemplates: number;
  totalExports: number;
  moduleWise: Array<{ module_key: string; count: number }>;
  recentExports: ReportExportEntry[];
  mostUsed: Array<{ id: number; name: string; module_key: string; usage_count: number; last_used_at: string | null }>;
}

export interface SaveTemplateBody {
  name: string;
  description?: string;
  module_key: string;
  fields: string[];
  filters?: ReportFilter[];
  sort?: ReportSort;
  group_by?: string[];
  aggregate_field?: string;
  is_shared?: boolean;
}

async function authFetch(path: string, body: unknown) {
  const token = localStorage.getItem("servms_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? "Request failed");
  }
  return res;
}

// Export is a binary file response, not the {success,data} JSON envelope, so
// it's fetched directly rather than through RTK Query's envelope unwrapping.
export async function exportGeneratedReport(body: GenerateReportBody & { format: "xlsx" | "csv"; report_template_id?: number }) {
  const res = await authFetch("/reports/export", body);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const fileName = match?.[1] ?? `${body.module_key}-report.${body.format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadMasterImportTemplate(masterKey: string) {
  const token = localStorage.getItem("servms_token");
  const res = await fetch(`${API_BASE}/reports/import/${masterKey}/template`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error("Unable to download import template");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${masterKey}-import-template.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export const reportApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getReportDashboard: builder.query<ReportDashboardMetrics, void>({
      query: () => "/reports/dashboard",
      providesTags: [{ type: "ReportTemplate" as const, id: "DASHBOARD" }],
    }),
    getReportModules: builder.query<ReportModuleMeta[], void>({
      query: () => "/reports/modules",
      providesTags: [{ type: "ReportTemplate" as const, id: "MODULES" }],
    }),
    generateReport: builder.mutation<GenerateReportResult, GenerateReportBody>({
      query: (body) => ({ url: "/reports/generate", method: "POST", body }),
    }),
    getReportTemplates: builder.query<ReportTemplate[], { module_key?: string } | void>({
      query: (args) => `/reports/templates${args?.module_key ? `?module_key=${args.module_key}` : ""}`,
      providesTags: (result) =>
        result
          ? [
              { type: "ReportTemplate" as const, id: "LIST" },
              ...result.map((t) => ({ type: "ReportTemplate" as const, id: t.id })),
            ]
          : [{ type: "ReportTemplate" as const, id: "LIST" }],
    }),
    getReportTemplateById: builder.query<ReportTemplate, number>({
      query: (id) => `/reports/templates/${id}`,
      providesTags: (_result, _error, id) => [{ type: "ReportTemplate" as const, id }],
    }),
    createReportTemplate: builder.mutation<{ id: number }, SaveTemplateBody>({
      query: (data) => ({ url: "/reports/templates", method: "POST", body: data }),
      invalidatesTags: [
        { type: "ReportTemplate" as const, id: "LIST" },
        { type: "ReportTemplate" as const, id: "DASHBOARD" },
      ],
    }),
    editReportTemplate: builder.mutation<unknown, { id: number; data: Partial<SaveTemplateBody> }>({
      query: ({ id, data }) => ({ url: `/reports/templates/${id}`, method: "PATCH", body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "ReportTemplate" as const, id: "LIST" },
        { type: "ReportTemplate" as const, id },
      ],
    }),
    deleteReportTemplate: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/reports/templates/${id}`, method: "DELETE" }),
      invalidatesTags: [
        { type: "ReportTemplate" as const, id: "LIST" },
        { type: "ReportTemplate" as const, id: "DASHBOARD" },
      ],
    }),

    getExportHistory: builder.query<{ total: number; rows: ReportExportEntry[] }, { module_key?: string; limit?: number; offset?: number }>({
      query: (filters) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== "" && params.set(k, String(v)));
        return `/reports/exports?${params.toString()}`;
      },
      providesTags: [{ type: "ReportTemplate" as const, id: "EXPORT_HISTORY" }],
    }),

    // ── Import Management ──
    getImportableMasters: builder.query<ImportableMaster[], void>({
      query: () => "/reports/import/masters",
      providesTags: [{ type: "ReportImport" as const, id: "MASTERS" }],
    }),
    getReportImportHistory: builder.query<ReportImportHistoryEntry[], { master_key?: string } | void>({
      query: (args) => `/reports/import/history${args?.master_key ? `?master_key=${args.master_key}` : ""}`,
      providesTags: [{ type: "ReportImport" as const, id: "HISTORY" }],
    }),
    importMasterData: builder.mutation<
      { importId: number; totalRecords: number; importedCount: number; duplicateCount: number; failedCount: number; failed: Array<{ row: number; reason: string }> },
      { masterKey: string; file: File }
    >({
      query: ({ masterKey, file }) => {
        const formData = new FormData();
        formData.append("file", file);
        return { url: `/reports/import/${masterKey}`, method: "POST", body: formData };
      },
      invalidatesTags: [{ type: "ReportImport" as const, id: "HISTORY" }],
    }),
  }),
});

export const {
  useGetReportDashboardQuery,
  useGetExportHistoryQuery,
  useGetReportModulesQuery,
  useGenerateReportMutation,
  useGetReportTemplatesQuery,
  useGetReportTemplateByIdQuery,
  useCreateReportTemplateMutation,
  useEditReportTemplateMutation,
  useDeleteReportTemplateMutation,
  useGetImportableMastersQuery,
  useGetReportImportHistoryQuery,
  useImportMasterDataMutation,
} = reportApi;
