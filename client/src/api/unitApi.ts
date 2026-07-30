import { apiSlice } from "../store/apiSlice";
import type { Unit, UnitContractType, UnitDurationType, UnitLocationType } from "../types";

export interface UnitFilters {
  search?: string;
  division_id?: number;
  station_id?: number;
  train_id?: number;
  cluster_id?: number;
  location_type?: UnitLocationType;
  contract_type?: UnitContractType;
  contract_category_id?: number;
  units_status?: string;
  limit?: number;
  offset?: number;
}

export interface UnitListResult {
  total: number;
  rows: Unit[];
}

export interface UnitMetrics {
  totalStations: number;
  activeClusters: number;
  inspectors: number;
  unassigned: number;
}

export interface UnitFormData {
  unit_code?: string;
  unit_name: string;
  location_type: UnitLocationType;
  station_id?: number;
  train_id?: number;
  cluster_id?: number;
  platform_location?: string;
  duration_type?: UnitDurationType;
  contract_type?: UnitContractType;
  contract_category_id?: number;
  area_description?: string;
  sketch_map_file?: File;
  contractor_id?: number;
  monthly_fee?: number;
  units_status?: Unit["units_status"];
}

function toFormData(data: Partial<UnitFormData>): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File) formData.append(key, value);
    else formData.append(key, String(value));
  });
  return formData;
}

function buildQuery(filters: UnitFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const unitApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUnits: builder.query<UnitListResult, UnitFilters>({
      query: (filters) => `/units${buildQuery(filters)}`,
      providesTags: (result) =>
        result
          ? [
              { type: "Unit" as const, id: "LIST" },
              ...result.rows.map((u) => ({ type: "Unit" as const, id: u.id })),
            ]
          : [{ type: "Unit" as const, id: "LIST" }],
    }),
    getUnitMetrics: builder.query<UnitMetrics, void>({
      query: () => "/units/metrics",
      providesTags: [{ type: "Unit" as const, id: "METRICS" }],
    }),
    createUnit: builder.mutation<{ id: number }, UnitFormData>({
      query: (data) => ({ url: "/units", method: "POST", body: toFormData(data) }),
      invalidatesTags: [
        { type: "Unit" as const, id: "LIST" },
        { type: "Unit" as const, id: "METRICS" },
        { type: "Master" as const, id: "UNITS" },
      ],
    }),
    editUnit: builder.mutation<Unit, { id: number; data: Partial<UnitFormData> }>({
      query: ({ id, data }) => ({ url: `/units/${id}`, method: "PATCH", body: toFormData(data) }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Unit" as const, id: "LIST" },
        { type: "Unit" as const, id },
        { type: "Unit" as const, id: "METRICS" },
        { type: "Master" as const, id: "UNITS" },
      ],
    }),
    deleteUnit: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/units/${id}`, method: "DELETE" }),
      invalidatesTags: [
        { type: "Unit" as const, id: "LIST" },
        { type: "Unit" as const, id: "METRICS" },
        { type: "Master" as const, id: "UNITS" },
      ],
    }),
  }),
});

export const {
  useGetUnitsQuery,
  useGetUnitMetricsQuery,
  useCreateUnitMutation,
  useEditUnitMutation,
  useDeleteUnitMutation,
} = unitApi;
