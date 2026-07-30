import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "https://servms.peymagen.com/api";
export const ASSET_BASE = API_BASE.replace(/\/api$/, "");

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
  total?: number;
}

interface ApiErrorShape {
  status: number;
  message: string;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem("servms_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

// Unwraps the server's {success,data,total} envelope so endpoint `transformResponse`s
// can stay simple, and mirrors the 401 handling that api/client.ts used to do (clear the
// session and bounce to /login) so logging in RTK Query didn't regress that behavior.
const envelopeBaseQuery: BaseQueryFn<string | FetchArgs, unknown, ApiErrorShape> = async (
  args,
  api,
  extraOptions
) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error) {
    const fetchError = result.error as FetchBaseQueryError;
    const status = typeof fetchError.status === "number" ? fetchError.status : 0;
    const body = fetchError.data as Partial<Envelope<unknown>> & { message?: string; error?: string };
    const message = body?.message ?? body?.error ?? "Request failed";

    const path = typeof args === "string" ? args : args.url;
    if (status === 401 && path !== "/users/login") {
      localStorage.removeItem("servms_token");
      localStorage.removeItem("servms_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return { error: { status, message } };
  }

  const body = result.data as Envelope<unknown>;
  return { data: body?.data, meta: result.meta };
};

// Single root API slice — every module injects its endpoints into this via
// `apiSlice.injectEndpoints` rather than creating separate `createApi` instances, so
// cache tags and the store middleware stay unified across the whole app.
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: envelopeBaseQuery,
  tagTypes: [
    "Penalty",
    "Contractor",
    "ContractorHistory",
    "Vendor",
    "VendorTransfer",
    "IdCard",
    "Approval",
    "User",
    "Role",
    "RolePermission",
    "Complaint",
    "ComplaintType",
    "ComplaintImport",
    "Inspection",
    "InspectionType",
    "ReportTemplate",
    "ReportImport",
    "Renewal",
    "AuditLog",
    "Notification",
    "Unit",
    "Master",
    "Dashboard",
  ],
  endpoints: () => ({}),
});
