export interface AuthUser {
  id: number;
  employee_id: string;
  username: string;
  full_name: string;
  designation: string | null;
  email: string | null;
  mobile: string | null;
  role_id: number;
  role_name: string;
  division_id: number | null;
  station_id: number | null;
  users_status: "active" | "inactive" | "suspended";
}

export interface ManagedUser extends AuthUser {
  division_name?: string | null;
  station_name?: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface Division {
  id: number;
  zone_id: number;
  division_code: string;
  division_name: string;
}

export interface Station {
  id: number;
  division_id: number;
  station_code: string;
  station_name: string;
}

export interface Role {
  id: number;
  role_name: string;
  description: string | null;
  roles_status: "active" | "inactive";
  user_count?: number;
}

export const MODULE_NAMES = [
  "vendor_management",
  "unit_masters",
  "contractor_database",
  "qr_issuance",
  "complaints_grievances",
  "penalties_fines",
] as const;

export type ModuleName = (typeof MODULE_NAMES)[number];

export const MODULE_LABELS: Record<ModuleName, string> = {
  vendor_management: "Vendor Management",
  unit_masters: "Unit Masters",
  contractor_database: "Contractor Database",
  qr_issuance: "QR Issuance",
  complaints_grievances: "Complaints & Grievances",
  penalties_fines: "Penalties & Fines",
};

export interface RolePermission {
  id: number;
  role_id: number;
  module_name: ModuleName;
  can_view: boolean | number;
  can_create: boolean | number;
  can_edit: boolean | number;
  can_delete: boolean | number;
  can_approve_reject: boolean | number;
  can_export: boolean | number;
}

export interface Contractor {
  id: number;
  contractor_code: string;
  company_name: string;
  primary_contact_name: string | null;
  primary_contact_mobile: string | null;
  official_email: string | null;
  registered_address: string | null;
  pan_number: string | null;
  gstin: string | null;
  license_number: string | null;
  license_validity_date: string | null;
  annual_registration_fee: number | null;
  irctc_licensed: boolean | number;
  compliance_rate: number | null;
  penalty_index: number | null;
  contractors_status: "active" | "pending_approval" | "suspended" | "expired";
  fee_status: "paid" | "overdue";
  division_id: number | null;
  division_name?: string | null;
  vendor_count?: number;
  unit_count?: number;
  joined_date: string | null;
}

export interface Unit {
  id: number;
  unit_code: string;
  unit_name: string;
  station_id: number;
  station_name?: string;
  station_code?: string;
  division_id?: number;
  division_name?: string;
  platform_location: string | null;
  cluster_name: string | null;
  area_description?: string | null;
  contract_type: "long_term" | "short_term" | "temporary";
  contractor_id: number | null;
  contractor_name?: string | null;
  monthly_fee: number | null;
  units_status: "active" | "expiring" | "inactive" | "inspection_pending";
  inspector_name?: string | null;
}

export interface Vendor {
  id: number;
  vendor_code: string;
  full_name: string;
  father_name: string | null;
  date_of_birth: string | null;
  aadhaar_number: string | null;
  mobile_number: string | null;
  email: string | null;
  profile_image: string | null;
  vendor_type: "stationary" | "statutory";
  contractor_id: number | null;
  contractor_name?: string | null;
  unit_id: number | null;
  unit_name?: string | null;
  station_id: number | null;
  station_name?: string | null;
  division_id: number | null;
  division_name?: string | null;
  vendor_status: "active" | "pending" | "expired";
  validity_start: string | null;
  validity_end: string | null;
  police_verification_status: "pending" | "completed";
  medical_fitness_status: "pending" | "completed";
  aadhar_linked: boolean | number;
  card_number?: string | null;
  card_status?: string | null;
}

export interface Complaint {
  id: number;
  complaint_code: string;
  unit_id: number;
  unit_name?: string | null;
  station_name?: string | null;
  division_name?: string | null;
  location_text: string | null;
  category: string;
  description: string;
  occurrence_date: string | null;
  occurrence_time: string | null;
  resolution_date?: string | null;
  priority: "low" | "medium" | "high";
  complaints_status: "open" | "investigating" | "resolved" | "rejected";
  registered_by_name?: string | null;
}

export interface Penalty {
  id: number;
  penalty_code: string;
  contractor_id: number | null;
  contractor_name?: string | null;
  vendor_id: number | null;
  vendor_name?: string | null;
  unit_id: number | null;
  unit_name?: string | null;
  amount: number;
  reason: string;
  penalties_status: "pending" | "recovered" | "waived";
  issued_date: string | null;
  resolution_date: string | null;
}

export interface IdCard {
  id: number;
  vendor_id: number;
  vendor_code: string;
  full_name: string;
  vendor_type: string;
  unit_name: string | null;
  station_name: string | null;
  division_name: string | null;
  id_number: string;
  qr_code_data: string;
  issued_date: string | null;
  cards_status: "active" | "pending" | "expired";
  last_checked_at: string | null;
  validity_start?: string | null;
  validity_end?: string | null;
  police_verification_status?: string | null;
  medical_fitness_status?: string | null;
  aadhar_linked?: boolean | number | null;
  contractor_name?: string | null;
}

export interface VendorRenewal {
  id: number;
  vendor_id: number;
  vendor_code?: string;
  full_name?: string;
  division_name?: string;
  renewal_period: string | null;
  previous_expiry: string | null;
  new_expiry: string | null;
  pvr_number: string | null;
  pvr_issue_date: string | null;
  renewals_status: "draft" | "pending_approval" | "approved" | "rejected";
}
