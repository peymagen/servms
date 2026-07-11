import { type BaseSchema } from "../../common/dto/base.dto";

export interface IContractor extends BaseSchema {
  contractor_code: string;
  company_name: string;
  primary_contact_name?: string;
  primary_contact_mobile?: string;
  official_email?: string;
  registered_address?: string;
  pan_number?: string;
  gstin?: string;
  epf_registration?: string;
  license_number?: string;
  license_validity_date?: string;
  annual_registration_fee?: number;
  irctc_licensed?: boolean;
  logo_image?: string;
  compliance_rate?: number;
  penalty_index?: number;
  contractors_status?: "active" | "pending_approval" | "suspended" | "expired";
  fee_status?: "paid" | "overdue";
  division_id?: number;
  joined_date?: string;
  created_by?: number;
}

export interface IContractorCreate {
  company_name: string;
  primary_contact_name?: string;
  primary_contact_mobile?: string;
  official_email?: string;
  registered_address?: string;
  pan_number?: string;
  gstin?: string;
  epf_registration?: string;
  license_number?: string;
  license_validity_date?: string;
  annual_registration_fee?: number;
  irctc_licensed?: boolean;
  logo_image?: string;
  division_id?: number;
  contractors_status?: "active" | "pending_approval" | "suspended" | "expired";
  fee_status?: "paid" | "overdue";
}

export interface IContractorUpdate {
  company_name?: string;
  primary_contact_name?: string;
  primary_contact_mobile?: string;
  official_email?: string;
  registered_address?: string;
  pan_number?: string;
  gstin?: string;
  epf_registration?: string;
  license_number?: string;
  license_validity_date?: string;
  annual_registration_fee?: number;
  irctc_licensed?: boolean;
  logo_image?: string;
  division_id?: number;
  contractors_status?: "active" | "pending_approval" | "suspended" | "expired";
  fee_status?: "paid" | "overdue";
}
