import { apiSlice } from "../store/apiSlice";

export interface StatusSummary {
  total: number;
  active: number;
  inactive: number;
  blacklisted: number;
  lastUpdated: string | null;
}

export interface UnitsSummary {
  total: number;
  active: number;
  idle: number;
  inactive: number;
  lastUpdated: string | null;
}

export interface PenaltySummary {
  imposed: { count: number; amount: number };
  recovered: { count: number; amount: number };
  due: {
    count: number;
    within7Days: number;
    within14Days: number;
    within30Days: number;
    overdue: number;
  };
  lastUpdated: string | null;
}

export interface PendingActionSummary {
  complaintsPendingAtr: { count: number; lastUpdated: string | null };
  inspectionsPendingAtr: { count: number; lastUpdated: string | null };
  licenseFeeUpdationDue: { within7Days: number; within14Days: number; overdue: number };
}

export interface ExpiredDueSoon {
  expired: number;
  dueSoon: number;
}

export interface CriticalAlerts {
  contractExpiry: { expired: number; expiring7Days: number; expiring30Days: number };
  unitCompliance: { licenseFees: ExpiredDueSoon; electricBill: ExpiredDueSoon; fssai: ExpiredDueSoon };
  vendorCompliance: { pvr: ExpiredDueSoon; medical: ExpiredDueSoon };
  penaltyOverdue: { total: number };
}

export interface DashboardSummary {
  view: string;
  units: UnitsSummary;
  contractors: StatusSummary;
  vendors: StatusSummary;
  penalty: PenaltySummary;
  pendingAction: PendingActionSummary;
  criticalAlerts: CriticalAlerts;
}

export interface DashboardGraphPoint {
  label: string;
  value: number;
}

export type DashboardGroupKey = "units" | "contractors" | "vendors" | "penalty" | "pending_action";

export interface DashboardQueryParams {
  view?: string;
  dateFrom?: string;
  dateTo?: string;
  unit_id?: number;
  contractor_id?: number;
  vendor_id?: number;
}

// Confirmed with the user: short polling instead of new WebSocket/SSE infra.
// Passed as a hook option at the call site (useGetDashboardSummaryQuery(params,
// { pollingInterval: DASHBOARD_POLL_INTERVAL_MS })), not on the endpoint itself.
export const DASHBOARD_POLL_INTERVAL_MS = 30_000;

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardSummary: builder.query<DashboardSummary, DashboardQueryParams | void>({
      query: (params) => ({ url: "/dashboard/summary", params: params ?? {} }),
      providesTags: [{ type: "Dashboard" as const, id: "SUMMARY" }],
    }),
    getDashboardGraphData: builder.query<DashboardGraphPoint[], { group: DashboardGroupKey } & DashboardQueryParams>({
      query: ({ group, ...params }) => ({ url: `/dashboard/graph/${group}`, params }),
    }),
    getDashboardToggleOptions: builder.query<string[], void>({
      query: () => "/dashboard/toggle-options",
    }),
    trackDashboardInteraction: builder.mutation<
      { tracked: boolean },
      { action: "alert_click" | "subgroup_click" | "report_open"; details?: string }
    >({
      query: (body) => ({ url: "/dashboard/track", method: "POST", body }),
    }),
  }),
});

export const {
  useGetDashboardSummaryQuery,
  useLazyGetDashboardGraphDataQuery,
  useGetDashboardToggleOptionsQuery,
  useTrackDashboardInteractionMutation,
} = dashboardApi;
