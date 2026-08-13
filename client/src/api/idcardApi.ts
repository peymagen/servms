import { apiSlice, API_BASE } from "../store/apiSlice";
import type { CardExpirySource, CardTemplate, IdCard, IdCardVerification } from "../types";

export interface IdCardFilters {
  search?: string;
  division_id?: number;
  approval_status?: string;
  limit?: number;
  offset?: number;
}

export interface IdCardListResult {
  total: number;
  rows: IdCard[];
}

function buildQuery(filters: IdCardFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const idcardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getIdCards: builder.query<IdCardListResult, IdCardFilters>({
      query: (filters) => `/idcards${buildQuery(filters)}`,
      providesTags: (result) =>
        result
          ? [
              { type: "IdCard" as const, id: "LIST" },
              ...result.rows.map((c) => ({ type: "IdCard" as const, id: c.vendor_id })),
            ]
          : [{ type: "IdCard" as const, id: "LIST" }],
    }),
    requestIdCard: builder.mutation<unknown, { vendorId: number; template: CardTemplate; expiry_source: CardExpirySource }>({
      query: ({ vendorId, ...body }) => ({ url: `/idcards/${vendorId}/request`, method: "POST", body }),
      invalidatesTags: (_result, _error, { vendorId }) => [
        { type: "IdCard" as const, id: "LIST" },
        { type: "IdCard" as const, id: vendorId },
      ],
    }),
    approveIdCard: builder.mutation<{ pdf_path: string }, number>({
      query: (vendorId) => ({ url: `/idcards/${vendorId}/approve`, method: "POST" }),
      invalidatesTags: (_result, _error, vendorId) => [
        { type: "IdCard" as const, id: "LIST" },
        { type: "IdCard" as const, id: vendorId },
      ],
    }),
    rejectIdCard: builder.mutation<unknown, { vendorId: number; reason: string }>({
      query: ({ vendorId, reason }) => ({ url: `/idcards/${vendorId}/reject`, method: "POST", body: { reason } }),
      invalidatesTags: (_result, _error, { vendorId }) => [
        { type: "IdCard" as const, id: "LIST" },
        { type: "IdCard" as const, id: vendorId },
      ],
    }),
    verifyIdCard: builder.query<IdCardVerification, string>({
      query: (code) => `/idcards/verify/${code}`,
    }),
  }),
});

export const {
  useGetIdCardsQuery,
  useRequestIdCardMutation,
  useApproveIdCardMutation,
  useRejectIdCardMutation,
  useVerifyIdCardQuery,
} = idcardApi;

// Binary PDF response, not the {success,data} JSON envelope, so it's fetched
// directly (with the bearer token) rather than through RTK Query's envelope unwrapping —
// this also lets the caller pick either card format on demand, regardless of which
// format the card was originally approved with.
export async function downloadIdCardPdf(vendorId: number, template: CardTemplate) {
  const token = localStorage.getItem("servms_token");
  const res = await fetch(`${API_BASE}/idcards/${vendorId}/pdf?template=${template}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? "Unable to download ID card PDF");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const fileName = match?.[1] ?? `id-card-${vendorId}-${template}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
