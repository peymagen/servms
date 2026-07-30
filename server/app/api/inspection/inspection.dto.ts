import { type BaseSchema } from "../../common/dto/base.dto";

export type InspectionStatus =
  | "draft"
  | "submitted"
  | "returned"
  | "assigned"
  | "atr_submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "closed";

// Linear happy-path progression. "returned" (Sub-admin -> Inspector, before
// assignment) and the ATR "sent_back" loop (-> back to "assigned") are
// branches, not part of this forward-only order.
export const INSPECTION_STAGE_ORDER: InspectionStatus[] = [
  "draft",
  "submitted",
  "assigned",
  "atr_submitted",
  "under_review",
  "approved",
  "closed",
];

export interface IInspection extends BaseSchema {
  inspection_no: string | null;
  unit_id: number;
  division_id?: number | null;
  station_id?: number | null;
  train_id?: number | null;
  inspecting_official_name?: string | null;
  designation?: string | null;
  place_of_posting?: string | null;
  inspection_category_id?: number | null;
  inspection_type_id?: number | null;
  inspection_date: string;
  observations?: string | null;
  deficiencies?: string | null;
  recommendations?: string | null;
  remarks?: string | null;
  priority: "low" | "medium" | "high";
  inspection_status: InspectionStatus;
  inspector_id?: number | null;
  assigned_to_user_id?: number | null;
  submitted_at?: string | null;
  closed_by?: number | null;
  closed_at?: string | null;
  status?: number;
}

export interface IInspectionCreate {
  unit_id: number;
  division_id?: number;
  station_id?: number;
  train_id?: number;
  inspecting_official_name?: string;
  designation?: string;
  place_of_posting?: string;
  inspection_category_id: number;
  inspection_type_id: number;
  inspection_date: string;
  observations?: string;
  deficiencies?: string;
  recommendations?: string;
  remarks?: string;
  priority?: "low" | "medium" | "high";
}

export interface IInspectionUpdate {
  unit_id?: number;
  division_id?: number;
  station_id?: number;
  train_id?: number;
  inspecting_official_name?: string;
  designation?: string;
  place_of_posting?: string;
  inspection_category_id?: number;
  inspection_type_id?: number;
  inspection_date?: string;
  observations?: string;
  deficiencies?: string;
  recommendations?: string;
  remarks?: string;
  priority?: "low" | "medium" | "high";
}

export interface IInspectionAssign {
  to_unit_id: number;
  assigned_to_user_id?: number;
  remarks?: string;
}
