import { apiSlice } from "../store/apiSlice";
import type { DropdownOption } from "../types";

export interface DropdownOptionCreate {
  category: string;
  division_id?: number | null;
  value: string;
  label: string;
  sort_order?: number;
}

export const dropdownApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDropdownOptions: builder.query<DropdownOption[], { category: string; division_id?: number }>({
      query: ({ category, division_id }) =>
        `/dropdowns?category=${encodeURIComponent(category)}${division_id ? `&division_id=${division_id}` : ""}`,
      providesTags: (_result, _error, { category }) => [{ type: "Master" as const, id: `dropdown-${category}` }],
    }),
    createDropdownOption: builder.mutation<{ id: number }, DropdownOptionCreate>({
      query: (data) => ({ url: "/dropdowns", method: "POST", body: data }),
      invalidatesTags: (_result, _error, { category }) => [{ type: "Master" as const, id: `dropdown-${category}` }],
    }),
    editDropdownOption: builder.mutation<unknown, { id: number; category: string; label?: string; sort_order?: number }>({
      query: ({ id, ...data }) => ({ url: `/dropdowns/${id}`, method: "PATCH", body: data }),
      invalidatesTags: (_result, _error, { category }) => [{ type: "Master" as const, id: `dropdown-${category}` }],
    }),
    deleteDropdownOption: builder.mutation<unknown, { id: number; category: string }>({
      query: ({ id }) => ({ url: `/dropdowns/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { category }) => [{ type: "Master" as const, id: `dropdown-${category}` }],
    }),
  }),
});

export const {
  useGetDropdownOptionsQuery,
  useCreateDropdownOptionMutation,
  useEditDropdownOptionMutation,
  useDeleteDropdownOptionMutation,
} = dropdownApi;
