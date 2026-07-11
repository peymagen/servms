import { type BaseSchema } from "../../common/dto/base.dto";

export interface IVendorRenewal extends BaseSchema {
  vendor_id: number;
  renewal_period?: string;
  previous_expiry?: string;
  new_expiry?: string;
  medical_fitness_doc?: string;
  pvr_number?: string;
  pvr_issue_date?: string;
  renewals_status?: "draft" | "pending_approval" | "approved" | "rejected";
  submitted_by?: number;
}

export interface IVendorRenewalCreate {
  vendor_id: number;
  renewal_period?: string;
  previous_expiry?: string;
  new_expiry?: string;
  medical_fitness_doc?: string;
  pvr_number?: string;
  pvr_issue_date?: string;
  renewals_status?: "draft" | "pending_approval";
}
