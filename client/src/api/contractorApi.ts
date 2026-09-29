import { apiSlice } from "../store/apiSlice";
import type { Contractor, ContractorUnit } from "../types";

export interface ContractorFilters {
  search?: string;
  division_id?: number;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ContractorListResult {
  total: number;
  rows: Contractor[];
}

export interface ContractorMetrics {
  totalActive: number;
  expiringSoon: number;
  feesOverdue: number;
  totalVendors: number;
}

export interface ContractorFormData {
  company_name: string;
  primary_contact_name?: string;
  primary_contact_mobile?: string;
  official_email?: string;
  registered_address?: string;
  pan_number?: string;
  gstin?: string;
  epf_registration?: string;
  license_number?: string;
  license_validity_date?: string;
  annual_registration_fee?: number;
  irctc_licensed?: boolean;
  division_id?: number;
  award_date?: string;
  tenure_months?: number;
  annual_contract_value?: number;
  contractors_status?: Contractor["contractors_status"];
  fee_status?: Contractor["fee_status"];
  logo_image?: File;
}

function toFormData(data: Partial<ContractorFormData>): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File) formData.append(key, value);
    else formData.append(key, String(value));
  });
  return formData;
}

function buildQuery(filters: ContractorFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const contractorApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getContractors: builder.query<ContractorListResult, ContractorFilters>({
      query: (filters) => `/contractors${buildQuery(filters)}`,
      providesTags: (result) =>
        result
          ? [
              { type: "Contractor" as const, id: "LIST" },
              ...result.rows.map((c) => ({ type: "Contractor" as const, id: c.id })),
            ]
          : [{ type: "Contractor" as const, id: "LIST" }],
    }),
    getContractorById: builder.query<Contractor, number>({
      query: (id) => `/contractors/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Contractor" as const, id }],
    }),
    getContractorMetrics: builder.query<ContractorMetrics, void>({
      query: () => "/contractors/metrics",
      providesTags: [{ type: "Contractor" as const, id: "METRICS" }],
    }),
    createContractor: builder.mutation<{ id: number; contractor_code: string }, ContractorFormData>({
      query: (data) => ({ url: "/contractors", method: "POST", body: toFormData(data) }),
      invalidatesTags: [
        { type: "Contractor" as const, id: "LIST" },
        { type: "Contractor" as const, id: "METRICS" },
      ],
    }),
    editContractor: builder.mutation<Contractor, { id: number; data: Partial<ContractorFormData> }>({
      query: ({ id, data }) => ({ url: `/contractors/${id}`, method: "PATCH", body: toFormData(data) }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Contractor" as const, id: "LIST" },
        { type: "Contractor" as const, id: "METRICS" },
        { type: "Master" as const, id: "CONTRACTORS" },
        { type: "Contractor" as const, id },
        { type: "ContractorHistory" as const, id },
      ],
    }),
    changeContractorStatus: builder.mutation<
      unknown,
      { id: number; contractors_status: Contractor["contractors_status"]; reason?: string }
    >({
      query: ({ id, ...body }) => ({ url: `/contractors/${id}/status`, method: "POST", body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Contractor" as const, id: "LIST" },
        { type: "Contractor" as const, id: "METRICS" },
        { type: "Contractor" as const, id },
        { type: "ContractorHistory" as const, id },
      ],
    }),
    deleteContractor: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/contractors/${id}`, method: "DELETE" }),
      invalidatesTags: [
        { type: "Contractor" as const, id: "LIST" },
        { type: "Contractor" as const, id: "METRICS" },
        { type: "Master" as const, id: "CONTRACTORS" },
      ],
    }),
    getContractorUnits: builder.query<ContractorUnit[], number>({
      query: (id) => `/contractors/${id}/units`,
      providesTags: (_result, _error, id) => [{ type: "Contractor" as const, id: `UNITS-${id}` }],
    }),
    assignUnit: builder.mutation<unknown, { id: number; unit_id: number }>({
      query: ({ id, unit_id }) => ({ url: `/contractors/${id}/units`, method: "POST", body: { unit_id } }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Contractor" as const, id: `UNITS-${id}` },
        { type: "Contractor" as const, id },
        { type: "Master" as const, id: "UNITS" },
        { type: "ContractorHistory" as const, id },
      ],
    }),
    unassignUnit: builder.mutation<unknown, { id: number; unitId: number }>({
      query: ({ id, unitId }) => ({ url: `/contractors/${id}/units/${unitId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Contractor" as const, id: `UNITS-${id}` },
        { type: "Contractor" as const, id },
        { type: "Master" as const, id: "UNITS" },
        { type: "ContractorHistory" as const, id },
      ],
    }),
  }),
});

export const {
  useGetContractorsQuery,
  useGetContractorByIdQuery,
  useGetContractorMetricsQuery,
  useCreateContractorMutation,
  useEditContractorMutation,
  useChangeContractorStatusMutation,
  useDeleteContractorMutation,
  useGetContractorUnitsQuery,
  useAssignUnitMutation,
  useUnassignUnitMutation,
} = contractorApi;
