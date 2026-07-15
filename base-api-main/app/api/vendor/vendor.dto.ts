import { type BaseSchema } from "../../common/dto/base.dto";

export interface IVendor extends BaseSchema {
  vendor_code: string;
  full_name: string;
  father_name?: string;
  date_of_birth?: string;
  aadhaar_number?: string;
  mobile_number?: string;
  email?: string;
  profile_image?: string;
  vendor_type?: "stationary" | "statutory";
  contractor_id?: number;
  unit_id?: number;
  station_id?: number;
  division_id?: number;
  vendor_status?: "active" | "pending" | "expired";
  validity_start?: string;
  validity_end?: string;
  police_verification_status?: "pending" | "completed";
  police_verification_number?: string;
  police_verification_date?: string;
  medical_fitness_status?: "pending" | "completed";
  medical_fitness_doc?: string;
  aadhar_linked?: boolean;
  created_by?: number;
}

export interface IVendorCreate {
  full_name: string;
  father_name?: string;
  date_of_birth?: string;
  aadhaar_number?: string;
  mobile_number?: string;
  email?: string;
  profile_image?: string;
  vendor_type?: "stationary" | "statutory";
  contractor_id?: number;
  unit_id?: number;
  station_id?: number;
  division_id?: number;
  vendor_status?: "active" | "pending" | "expired";
  validity_start?: string;
  validity_end?: string;
  police_verification_status?: "pending" | "completed";
  police_verification_number?: string;
  police_verification_date?: string;
  medical_fitness_status?: "pending" | "completed";
  medical_fitness_doc?: string;
  aadhar_linked?: number;
}

export interface IVendorUpdate {
  full_name?: string;
  father_name?: string;
  date_of_birth?: string;
  aadhaar_number?: string;
  mobile_number?: string;
  email?: string;
  profile_image?: string;
  vendor_type?: "stationary" | "statutory";
  contractor_id?: number;
  unit_id?: number;
  station_id?: number;
  division_id?: number;
  vendor_status?: "active" | "pending" | "expired";
  validity_start?: string;
  validity_end?: string;
  police_verification_status?: "pending" | "completed";
  police_verification_number?: string;
  police_verification_date?: string;
  medical_fitness_status?: "pending" | "completed";
  medical_fitness_doc?: string;
  aadhar_linked?: number;
}
