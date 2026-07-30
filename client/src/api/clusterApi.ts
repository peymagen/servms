import { apiSlice } from "../store/apiSlice";
import type { ClusterType, LocationCluster } from "../types";

export interface ClusterFilters {
  search?: string;
  division_id?: number;
  cluster_type?: ClusterType;
  limit?: number;
  offset?: number;
}

export interface ClusterListResult {
  total: number;
  rows: LocationCluster[];
}

export interface ClusterFormData {
  division_id: number;
  cluster_name: string;
  cluster_type: ClusterType;
  member_ids: number[];
}

export interface ClusterUpdateData {
  cluster_name?: string;
  member_ids?: number[];
}

function buildQuery(filters: ClusterFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const clusterApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getClusters: builder.query<ClusterListResult, ClusterFilters>({
      query: (filters) => `/clusters${buildQuery(filters)}`,
      providesTags: (result) =>
        result
          ? [
              { type: "Master" as const, id: "CLUSTERS" },
              ...result.rows.map((c) => ({ type: "Master" as const, id: `cluster-${c.id}` })),
            ]
          : [{ type: "Master" as const, id: "CLUSTERS" }],
    }),
    getClusterById: builder.query<LocationCluster, number>({
      query: (id) => `/clusters/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Master" as const, id: `cluster-${id}` }],
    }),
    createCluster: builder.mutation<{ id: number }, ClusterFormData>({
      query: (data) => ({ url: "/clusters", method: "POST", body: data }),
      invalidatesTags: [{ type: "Master" as const, id: "CLUSTERS" }],
    }),
    editCluster: builder.mutation<LocationCluster, { id: number; data: ClusterUpdateData }>({
      query: ({ id, data }) => ({ url: `/clusters/${id}`, method: "PATCH", body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Master" as const, id: "CLUSTERS" },
        { type: "Master" as const, id: `cluster-${id}` },
      ],
    }),
    deleteCluster: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/clusters/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Master" as const, id: "CLUSTERS" }],
    }),
  }),
});

export const {
  useGetClustersQuery,
  useGetClusterByIdQuery,
  useCreateClusterMutation,
  useEditClusterMutation,
  useDeleteClusterMutation,
} = clusterApi;
