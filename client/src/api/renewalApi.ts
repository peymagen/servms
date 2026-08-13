import { apiSlice } from "../store/apiSlice";
import type { RenewalType, VendorRenewal } from "../types";

export interface RenewalListResult {
  total: number;
  rows: VendorRenewal[];
}

export interface CreateRenewalBody {
  vendor_id: number;
  renewal_period?: string;
  renewal_type?: RenewalType;
  new_expiry?: string;
  pvr_number?: string;
  pvr_issue_date?: string;
  pvr_document?: File;
  medical_issue_date?: string;
  medical_number?: string;
  medical_fitness_doc?: File;
  renewals_status?: VendorRenewal["renewals_status"];
}

function toFormData(data: CreateRenewalBody): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File) formData.append(key, value);
    else formData.append(key, String(value));
  });
  return formData;
}

export const renewalApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRenewals: builder.query<RenewalListResult, { limit: number; offset: number }>({
      query: ({ limit, offset }) => `/renewals?limit=${limit}&offset=${offset}`,
      providesTags: (result) =>
        result
          ? [
              { type: "Renewal" as const, id: "LIST" },
              ...result.rows.map((r) => ({ type: "Renewal" as const, id: r.id })),
            ]
          : [{ type: "Renewal" as const, id: "LIST" }],
    }),
    createRenewal: builder.mutation<{ id: number }, CreateRenewalBody>({
      query: (body) => ({ url: "/renewals", method: "POST", body: toFormData(body) }),
      invalidatesTags: [{ type: "Renewal" as const, id: "LIST" }],
    }),
    updateRenewalStatus: builder.mutation<unknown, { id: number; renewals_status: "approved" | "rejected" }>({
      query: ({ id, renewals_status }) => ({ url: `/renewals/${id}`, method: "PATCH", body: { renewals_status } }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Renewal" as const, id: "LIST" },
        { type: "Renewal" as const, id },
      ],
    }),
  }),
});

export const { useGetRenewalsQuery, useCreateRenewalMutation, useUpdateRenewalStatusMutation } = renewalApi;
