import { type BaseSchema } from "../../common/dto/base.dto";

export type ComplaintSource = "railmadad" | "cpgrams" | "manual";

export type ComplaintStatus =
  | "pending"
  | "assigned"
  | "under_review"
  | "action_taken"
  | "approved"
  | "rejected"
  | "closed";

// Linear happy-path progression (Created -> Assigned -> ATR -> Sub-admin
// review -> Admin acceptance -> Closed). "rejected" is a branch reachable
// from action_taken/under_review, not part of this forward-only order.
export const COMPLAINT_STAGE_ORDER: ComplaintStatus[] = [
  "pending",
  "assigned",
  "under_review",
  "action_taken",
  "approved",
  "closed",
];

export interface IComplaint extends BaseSchema {
  complaint_code: string;
  complaint_source: ComplaintSource;
  complaint_ref_no?: string | null;
  portal_registration_number?: string | null;
  manual_dak_reference_number?: string | null;
  eoffice_computer_number?: string | null;
  unit_id: number;
  division_id?: number | null;
  train_id?: number | null;
  station_id?: number | null;
  assigned_to_user_id?: number | null;
  location_text?: string;
  category?: string;
  complaint_type_id?: number | null;
  complaint_subtype_id?: number | null;
  description: string;
  complainant_name?: string | null;
  complainant_mobile?: string | null;
  complainant_email?: string | null;
  occurrence_date?: string;
  occurrence_time?: string;
  complaint_date?: string;
  resolution_date?: string | null;
  priority: "low" | "medium" | "high";
  complaints_status: ComplaintStatus;
  registered_by?: number;
  closed_by?: number | null;
  closed_at?: string | null;
  import_batch_id?: number | null;
  status?: number;
}

export interface IComplaintCreate {
  complaint_source?: "cpgrams" | "manual";
  portal_registration_number?: string;
  manual_dak_reference_number?: string;
  eoffice_computer_number?: string;
  unit_id: number;
  division_id?: number;
  train_id?: number;
  station_id?: number;
  location_text?: string;
  complaint_type_id: number;
  complaint_subtype_id: number;
  description: string;
  complainant_name?: string;
  complainant_mobile?: string;
  complainant_email?: string;
  occurrence_date?: string;
  occurrence_time?: string;
  complaint_date?: string;
  priority?: "low" | "medium" | "high";
}

export interface IComplaintUpdate {
  location_text?: string;
  complaint_type_id?: number;
  complaint_subtype_id?: number;
  description?: string;
  priority?: "low" | "medium" | "high";
  complainant_name?: string;
  complainant_mobile?: string;
  complainant_email?: string;
}

export interface IComplaintAssign {
  to_unit_id: number;
  assigned_to_user_id?: number;
  remarks?: string;
}

export interface IComplaintAtrSubmit {
  remarks: string;
}

export interface IComplaintAtrDecision {
  remarks?: string;
}
