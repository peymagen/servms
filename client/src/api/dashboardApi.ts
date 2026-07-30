import { apiSlice } from "../store/apiSlice";

export interface DivisionPerf {
  divisionName: string;
  score: number;
  vendorCount: number;
}

export interface DivisionServiceRow {
  id: number;
  code: string;
  name: string;
  vendors: number;
  compliance: number;
  score: string;
}

export interface DashboardAlert {
  type: string;
  title: string;
  description: string;
  time: string;
}

export interface DashboardStats {
  totalRegisteredVendors: number;
  activeContractors: number;
  penaltiesRecovered: number;
  pendingPenaltyOrders: number;
  pendingComplaints: number;
  divisionWisePerformance: DivisionPerf[];
  inspectionSummary: { satisfactory: number; minorIssues: number; criticalFailures: number };
  recentCriticalAlerts: DashboardAlert[];
  divisionServicePerformance: DivisionServiceRow[];
}

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<DashboardStats, void>({
      query: () => "/dashboard/stats",
      providesTags: [{ type: "Dashboard" as const, id: "STATS" }],
    }),
  }),
});

export const { useGetDashboardStatsQuery } = dashboardApi;
