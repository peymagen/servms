import { type BaseSchema } from "../../common/dto/base.dto";

export type VerificationStatus = "pending" | "verified" | "rejected" | "expired";
export type VendorDocumentType = "AADHAAR" | "MEDICAL" | "POLICE_VERIFICATION";

export interface IVendor extends BaseSchema {
  vendor_code: string;
  full_name: string;
  father_name?: string;
  date_of_birth?: string;
  aadhaar_number?: string;
  mobile_number?: string;
  address?: string;
  profile_image?: string;
  signature_path?: string;
  blood_group?: string;
  vendor_type?: "train_tsv" | "station_pf" | "station_stall" | "station_others";
  contractor_id?: number;
  unit_id?: number;
  station_id?: number;
  division_id?: number;
  vendor_status?: "active" | "pending" | "expired";
  validity_start?: string;
  validity_end?: string;
  police_verification_status?: VerificationStatus;
  police_verification_issue_date?: string;
  police_verification_valid_till?: string;
  police_verification_remarks?: string;
  police_verification_document?: string;
  medical_verification_status?: VerificationStatus;
  medical_verification_issue_date?: string;
  medical_verification_valid_till?: string;
  medical_verification_remarks?: string;
  medical_verification_document?: string;
  created_by?: number;
}

export interface IVendorCreate {
  full_name: string;
  father_name?: string;
  date_of_birth?: string;
  aadhaar_number?: string;
  mobile_number?: string;
  address?: string;
  profile_image?: string;
  signature_path?: string;
  blood_group?: string;
  vendor_type?: "train_tsv" | "station_pf" | "station_stall" | "station_others";
  contractor_id?: number;
  unit_id?: number;
  station_id?: number;
  division_id?: number;
  vendor_status?: "active" | "pending" | "expired";
  validity_start?: string;
  validity_end?: string;
  police_verification_status?: VerificationStatus;
  police_verification_issue_date?: string;
  police_verification_valid_till?: string;
  police_verification_remarks?: string;
  police_verification_document?: string;
  medical_verification_status?: VerificationStatus;
  medical_verification_issue_date?: string;
  medical_verification_valid_till?: string;
  medical_verification_remarks?: string;
  medical_verification_document?: string;
}

export interface IVendorUpdate {
  full_name?: string;
  father_name?: string;
  date_of_birth?: string;
  aadhaar_number?: string;
  mobile_number?: string;
  address?: string;
  profile_image?: string;
  signature_path?: string;
  blood_group?: string;
  vendor_type?: "train_tsv" | "station_pf" | "station_stall" | "station_others";
  contractor_id?: number;
  unit_id?: number;
  station_id?: number;
  division_id?: number;
  vendor_status?: "active" | "pending" | "expired";
  validity_start?: string;
  validity_end?: string;
  police_verification_status?: VerificationStatus;
  police_verification_issue_date?: string;
  police_verification_valid_till?: string;
  police_verification_remarks?: string;
  police_verification_document?: string;
  medical_verification_status?: VerificationStatus;
  medical_verification_issue_date?: string;
  medical_verification_valid_till?: string;
  medical_verification_remarks?: string;
  medical_verification_document?: string;
}

export interface IVendorVerificationUpdate {
  status?: VerificationStatus;
  issue_date?: string;
  valid_till?: string;
  remarks?: string;
}

export interface IVendorDocument extends BaseSchema {
  vendor_id: number;
  document_type: VendorDocumentType;
  document_path: string;
  original_name?: string;
  uploaded_by?: number;
  uploaded_at?: string;
}
