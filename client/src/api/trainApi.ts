import { apiSlice } from "../store/apiSlice";
import type { Train } from "../types";

export interface TrainFilters {
  search?: string;
  division_id?: number;
  limit?: number;
  offset?: number;
}

export interface TrainListResult {
  total: number;
  rows: Train[];
}

export interface TrainFormData {
  division_id: number;
  train_number: string;
  train_name: string;
  source: string;
  destination: string;
  opposite_train_number?: string;
  opposite_train_name?: string;
  opposite_source?: string;
  opposite_destination?: string;
}

function buildQuery(filters: TrainFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const trainApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTrains: builder.query<TrainListResult, TrainFilters>({
      query: (filters) => `/trains${buildQuery(filters)}`,
      providesTags: (result) =>
        result
          ? [
              { type: "Master" as const, id: "TRAINS" },
              ...result.rows.map((t) => ({ type: "Master" as const, id: `train-${t.id}` })),
            ]
          : [{ type: "Master" as const, id: "TRAINS" }],
    }),
    createTrain: builder.mutation<{ id: number }, TrainFormData>({
      query: (data) => ({ url: "/trains", method: "POST", body: data }),
      invalidatesTags: [{ type: "Master" as const, id: "TRAINS" }],
    }),
    editTrain: builder.mutation<Train, { id: number; data: Partial<TrainFormData> }>({
      query: ({ id, data }) => ({ url: `/trains/${id}`, method: "PATCH", body: data }),
      invalidatesTags: [{ type: "Master" as const, id: "TRAINS" }],
    }),
    deleteTrain: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/trains/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Master" as const, id: "TRAINS" }],
    }),
  }),
});

export const { useGetTrainsQuery, useCreateTrainMutation, useEditTrainMutation, useDeleteTrainMutation } = trainApi;
