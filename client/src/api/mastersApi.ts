import { apiSlice } from "../store/apiSlice";
import type { Contractor, Division, Role, Station, Unit, Zone } from "../types";

export interface VendorLite {
  id: number;
  vendor_code: string;
  full_name: string;
  contractor_id: number | null;
  unit_id: number | null;
  division_id: number | null;
}

export interface ComplaintLite {
  id: number;
  complaint_code: string;
  category: string | null;
  occurrence_date: string | null;
}

export interface InspectionLite {
  id: number;
  unit_id: number | null;
  unit_name: string | null;
  inspection_date: string;
  result: "satisfactory" | "minor_issues" | "critical_failure";
}

export interface StationFormData {
  division_id: number;
  station_name: string;
  station_code: string;
  platform_count?: number;
}

export interface StationBulkImportResult {
  insertedCount: number;
  skippedCount: number;
  inserted: string[];
  skipped: Array<{ row: number; reason: string }>;
}

export const mastersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getZones: builder.query<Zone[], void>({
      query: () => "/masters/zones",
      providesTags: [{ type: "Master" as const, id: "ZONES" }],
    }),
    getDivisions: builder.query<Division[], void>({
      query: () => "/masters/divisions",
      providesTags: [{ type: "Master" as const, id: "DIVISIONS" }],
    }),
    getStations: builder.query<Station[], number | void>({
      query: (divisionId) => `/masters/stations${divisionId ? `?division_id=${divisionId}` : ""}`,
      providesTags: [{ type: "Master" as const, id: "STATIONS" }],
    }),
    createStation: builder.mutation<{ id: number }, StationFormData>({
      query: (data) => ({ url: "/masters/stations", method: "POST", body: data }),
      invalidatesTags: [{ type: "Master" as const, id: "STATIONS" }],
    }),
    editStation: builder.mutation<unknown, { id: number; data: Partial<StationFormData> }>({
      query: ({ id, data }) => ({ url: `/masters/stations/${id}`, method: "PATCH", body: data }),
      invalidatesTags: [{ type: "Master" as const, id: "STATIONS" }],
    }),
    deleteStation: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/masters/stations/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Master" as const, id: "STATIONS" }],
    }),
    bulkImportStations: builder.mutation<StationBulkImportResult, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return { url: "/masters/stations/bulk-import", method: "POST", body: formData };
      },
      invalidatesTags: [{ type: "Master" as const, id: "STATIONS" }],
    }),
    getUnitsLite: builder.query<Unit[], number | void>({
      query: (stationId) => `/masters/units${stationId ? `?station_id=${stationId}` : ""}`,
      providesTags: [{ type: "Master" as const, id: "UNITS" }],
    }),
    getContractorsLite: builder.query<Contractor[], number | void>({
      query: (divisionId) => `/masters/contractors${divisionId ? `?division_id=${divisionId}` : ""}`,
      providesTags: [{ type: "Master" as const, id: "CONTRACTORS" }],
    }),
    getVendorsLite: builder.query<VendorLite[], number | void>({
      query: (contractorId) => `/masters/vendors${contractorId ? `?contractor_id=${contractorId}` : ""}`,
      providesTags: [{ type: "Master" as const, id: "VENDORS" }],
    }),
    getRolesLite: builder.query<Role[], void>({
      query: () => "/masters/roles",
      providesTags: [{ type: "Master" as const, id: "ROLES" }],
    }),
    getComplaintsLite: builder.query<ComplaintLite[], void>({
      query: () => "/masters/complaints",
      providesTags: [{ type: "Master" as const, id: "COMPLAINTS" }],
    }),
    getInspectionsLite: builder.query<InspectionLite[], void>({
      query: () => "/masters/inspections",
      providesTags: [{ type: "Master" as const, id: "INSPECTIONS" }],
    }),
  }),
});

export const {
  useGetZonesQuery,
  useGetDivisionsQuery,
  useGetStationsQuery,
  useCreateStationMutation,
  useEditStationMutation,
  useDeleteStationMutation,
  useBulkImportStationsMutation,
  useGetUnitsLiteQuery,
  useGetContractorsLiteQuery,
  useGetVendorsLiteQuery,
  useGetRolesLiteQuery,
  useGetComplaintsLiteQuery,
  useGetInspectionsLiteQuery,
} = mastersApi;
