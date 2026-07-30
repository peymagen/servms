import { apiSlice } from "../store/apiSlice";

export type NotificationModule = "vendor_master" | "complaints" | "penalties" | "user_management" | "inspections";
export type NotificationSeverity = "critical" | "warning" | "info";
export type ModuleFilter = "all" | NotificationModule;

export interface NotificationItem {
  id: string;
  module: NotificationModule;
  moduleLabel: string;
  severity: NotificationSeverity;
  title: string;
  description: string;
  time: string;
}

export interface NotificationCounts {
  all: number;
  vendor_master: number;
  complaints: number;
  penalties: number;
  user_management: number;
  inspections: number;
}

export interface NotificationsResponse {
  counts: NotificationCounts;
  total: number;
  hasMore: boolean;
  rows: NotificationItem[];
}

export const notificationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<NotificationsResponse, { module: ModuleFilter; limit: number }>({
      query: ({ module, limit }) => `/notifications?module=${module}&limit=${limit}`,
      providesTags: [{ type: "Notification" as const, id: "LIST" }],
    }),
  }),
});

export const { useGetNotificationsQuery } = notificationApi;
