import { apiSlice } from "../store/apiSlice";
import type { Vendor, VendorDocument, VendorDocumentType, VendorType, VerificationStatus } from "../types";

export interface VendorFilters {
  search?: string;
  division_id?: number;
  unit_id?: number;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface VendorListResult {
  total: number;
  rows: Vendor[];
}

export interface VendorMetrics {
  totalActiveVendors: number;
  policeVerified: number;
  expiredMedicals: number;
  expiredPvr: number;
  expiringSoon: number;
  awaitingApproval: number;
}

export interface VendorFormData {
  full_name: string;
  father_name?: string;
  date_of_birth?: string;
  aadhaar_number?: string;
  mobile_number: string;
  address?: string;
  vendor_type?: VendorType;
  contractor_id?: number;
  unit_id?: number;
  station_id?: number;
  division_id?: number;
  vendor_status?: Vendor["vendor_status"];
  validity_start?: string;
  validity_end?: string;
  police_verification_status?: VerificationStatus;
  police_verification_issue_date?: string;
  police_verification_valid_till?: string;
  police_verification_remarks?: string;
  medical_verification_status?: VerificationStatus;
  medical_verification_issue_date?: string;
  medical_verification_valid_till?: string;
  medical_verification_remarks?: string;
  profile_image?: File;
  signature?: File;
  aadhaar_document?: File;
  medical_verification_document?: File;
  police_verification_document?: File;
}

function toFormData(data: Partial<VendorFormData>): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File) formData.append(key, value);
    else formData.append(key, String(value));
  });
  return formData;
}

function buildQuery(filters: VendorFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const vendorApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getVendors: builder.query<VendorListResult, VendorFilters>({
      query: (filters) => `/vendors${buildQuery(filters)}`,
      providesTags: (result) =>
        result
          ? [
              { type: "Vendor" as const, id: "LIST" },
              ...result.rows.map((v) => ({ type: "Vendor" as const, id: v.id })),
            ]
          : [{ type: "Vendor" as const, id: "LIST" }],
    }),
    getVendorById: builder.query<Vendor, number>({
      query: (id) => `/vendors/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Vendor" as const, id }],
    }),
    getVendorMetrics: builder.query<VendorMetrics, void>({
      query: () => "/vendors/metrics",
      providesTags: [{ type: "Vendor" as const, id: "METRICS" }],
    }),
    createVendor: builder.mutation<{ id: number; vendor_code: string }, VendorFormData>({
      query: (data) => ({ url: "/vendors", method: "POST", body: toFormData(data) }),
      invalidatesTags: [
        { type: "Vendor" as const, id: "LIST" },
        { type: "Vendor" as const, id: "METRICS" },
      ],
    }),
    editVendor: builder.mutation<Vendor, { id: number; data: Partial<VendorFormData> }>({
      query: ({ id, data }) => ({ url: `/vendors/${id}`, method: "PATCH", body: toFormData(data) }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Vendor" as const, id: "LIST" },
        { type: "Vendor" as const, id },
        { type: "VendorTransfer" as const, id },
      ],
    }),
    deleteVendor: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/vendors/${id}`, method: "DELETE" }),
      invalidatesTags: [
        { type: "Vendor" as const, id: "LIST" },
        { type: "Vendor" as const, id: "METRICS" },
      ],
    }),
    transferVendorUnit: builder.mutation<unknown, { id: number; unit_id: number }>({
      query: ({ id, unit_id }) => ({ url: `/vendors/${id}/transfer-unit`, method: "POST", body: { unit_id } }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Vendor" as const, id: "LIST" },
        { type: "Vendor" as const, id },
        { type: "VendorTransfer" as const, id },
      ],
    }),
    transferVendorContractor: builder.mutation<unknown, { id: number; contractor_id: number }>({
      query: ({ id, contractor_id }) => ({
        url: `/vendors/${id}/transfer-contractor`,
        method: "POST",
        body: { contractor_id },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Vendor" as const, id: "LIST" },
        { type: "Vendor" as const, id },
        { type: "VendorTransfer" as const, id },
      ],
    }),
    updatePoliceVerification: builder.mutation<Vendor, { id: number; status: string; issue_date?: string; valid_till?: string; remarks?: string; document?: File }>({
      query: ({ id, ...body }) => ({ url: `/vendors/${id}/verification/police`, method: "PATCH", body: toFormData(body as any) }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Vendor" as const, id }, { type: "Vendor" as const, id: "LIST" }, { type: "Vendor" as const, id: "METRICS" }],
    }),
    updateMedicalVerification: builder.mutation<Vendor, { id: number; status: string; issue_date?: string; valid_till?: string; remarks?: string; document?: File }>({
      query: ({ id, ...body }) => ({ url: `/vendors/${id}/verification/medical`, method: "PATCH", body: toFormData(body as any) }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Vendor" as const, id }, { type: "Vendor" as const, id: "LIST" }, { type: "Vendor" as const, id: "METRICS" }],
    }),
    getVendorDocuments: builder.query<VendorDocument[], number>({
      query: (id) => `/vendors/${id}/documents`,
      providesTags: (_result, _error, id) => [{ type: "Vendor" as const, id: `DOCS-${id}` }],
    }),
    uploadVendorDocument: builder.mutation<unknown, { id: number; documentType: VendorDocumentType; file: File }>({
      query: ({ id, documentType, file }) => {
        const formData = new FormData();
        formData.append("document_type", documentType);
        formData.append("document", file);
        return { url: `/vendors/${id}/documents`, method: "POST", body: formData };
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: "Vendor" as const, id: `DOCS-${id}` }],
    }),
  }),
});

export const {
  useGetVendorsQuery,
  useLazyGetVendorsQuery,
  useGetVendorByIdQuery,
  useGetVendorMetricsQuery,
  useCreateVendorMutation,
  useEditVendorMutation,
  useDeleteVendorMutation,
  useTransferVendorUnitMutation,
  useTransferVendorContractorMutation,
  useUpdatePoliceVerificationMutation,
  useUpdateMedicalVerificationMutation,
  useGetVendorDocumentsQuery,
  useUploadVendorDocumentMutation,
} = vendorApi;
