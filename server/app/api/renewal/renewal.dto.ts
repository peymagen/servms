import { type BaseSchema } from "../../common/dto/base.dto";

export type RenewalType = "pvr" | "medical" | "both";

export interface IVendorRenewal extends BaseSchema {
  vendor_id: number;
  renewal_period?: string;
  renewal_type?: RenewalType;
  previous_expiry?: string;
  new_expiry?: string;
  medical_fitness_doc?: string;
  medical_issue_date?: string;
  medical_number?: string;
  pvr_number?: string;
  pvr_issue_date?: string;
  pvr_document?: string;
  renewals_status?: "draft" | "pending_approval" | "approved" | "rejected";
  submitted_by?: number;
}

export interface IVendorRenewalCreate {
  vendor_id: number;
  renewal_period?: string;
  renewal_type?: RenewalType;
  previous_expiry?: string;
  new_expiry?: string;
  medical_fitness_doc?: string;
  medical_issue_date?: string;
  medical_number?: string;
  pvr_number?: string;
  pvr_issue_date?: string;
  pvr_document?: string;
  renewals_status?: "draft" | "pending_approval";
}
