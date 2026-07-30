import { apiSlice } from "../store/apiSlice";
import type { AuditLog } from "../types";

export interface AuditLogFilters {
  module?: string;
  record_id?: string;
  user_id?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

function buildQuery(filters: AuditLogFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export interface AuditLogListResult {
  total: number;
  rows: AuditLog[];
}

export const auditApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAuditLogs: builder.query<AuditLogListResult, AuditLogFilters>({
      query: (filters = {}) => `/audit-logs${buildQuery(filters)}`,
      providesTags: (result) =>
        result
          ? [
              { type: "AuditLog" as const, id: "LIST" },
              ...result.rows.map((log) => ({ type: "AuditLog" as const, id: log.id })),
            ]
          : [{ type: "AuditLog" as const, id: "LIST" }],
    }),
    getAuditModules: builder.query<string[], void>({
      query: () => "/audit-logs/modules",
    }),
  }),
});

export const { useGetAuditLogsQuery, useGetAuditModulesQuery } = auditApi;
