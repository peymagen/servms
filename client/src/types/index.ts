// JAG/SG apply to Admin-tier roles; Sr. Supervisor/JS/SS apply to Sub Admin-tier roles.
// Card Signing Authority eligibility remains JS/SS-only regardless of role.
export type DesignationGrade = "JAG" | "SG" | "SR_SUPERVISOR" | "JS" | "SS" | "OTHER";

export interface AuthUser {
  id: number;
  employee_id: string;
  hrms_id?: string | null;
  username: string;
  full_name: string;
  designation: string | null;
  designation_grade?: DesignationGrade | null;
  card_signing_authority?: boolean | number;
  email: string | null;
  mobile: string | null;
  is_temp_password?: boolean | number;
  role_id: number;
  role_name: string;
  division_id: number | null;
  zone_id?: number | null;
  station_id: number | null;
  profile_image?: string | null;
  signature_path?: string | null;
  users_status: "active" | "inactive" | "suspended" | "pending_approval";
}

export interface ManagedUser extends AuthUser {
  division_name?: string | null;
  zone_name?: string | null;
  station_name?: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface Zone {
  id: number;
  zone_name: string;
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
  division_name?: string | null;
  station_code: string;
  station_name: string;
  platform_count: number | null;
}

export interface Train {
  id: number;
  division_id: number;
  division_name?: string | null;
  train_number: string;
  train_name: string;
  source: string;
  destination: string;
  opposite_train_number: string | null;
  opposite_train_name: string | null;
  opposite_source: string | null;
  opposite_destination: string | null;
}

export type ClusterType = "station" | "train";

export interface ClusterMember {
  member_row_id: number;
  station_id: number | null;
  train_id: number | null;
  station_name?: string | null;
  station_code?: string | null;
  train_name?: string | null;
  train_number?: string | null;
}

export interface LocationCluster {
  id: number;
  division_id: number;
  division_name?: string | null;
  cluster_name: string;
  cluster_type: ClusterType;
  member_count?: number;
  members?: ClusterMember[];
}

export interface DropdownOption {
  id: number;
  category: string;
  parent_id?: number | null;
  division_id: number | null;
  value: string;
  label: string;
  sort_order: number;
  status?: number;
}

export interface Role {
  id: number;
  role_name: string;
  description: string | null;
  roles_status: "active" | "inactive";
  user_count?: number;
}

export const MODULE_NAMES = [
  "user_management",
  "role_management",
  "vendor_management",
  "contractor_management",
  "unit_management",
  "location_management",
  "id_card_management",
  "penalty_management",
  "complaint_management",
  "inspection_management",
  "audit_logs",
  "reports",
  "dashboard",
  "admin_module",
] as const;

export type ModuleName = (typeof MODULE_NAMES)[number];

export const MODULE_LABELS: Record<ModuleName, string> = {
  user_management: "User Management",
  role_management: "Role Management",
  vendor_management: "Vendor Management",
  contractor_management: "Contractor Management",
  unit_management: "Unit Management",
  location_management: "Location Management",
  id_card_management: "ID Card Management",
  penalty_management: "Penalty Management",
  complaint_management: "Complaint Management",
  inspection_management: "Inspection Management",
  audit_logs: "Audit Logs",
  reports: "Reports",
  dashboard: "Dashboard",
  admin_module: "Admin Module",
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

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve_reject" | "export";

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_full_name?: string | null;
  user_username?: string | null;
  role_name: string | null;
  action: string;
  module_name: string | null;
  record_id: string | null;
  old_data: string | null;
  new_data: string | null;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
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
  award_date: string | null;
  tenure_months: number | null;
  annual_contract_value: number | null;
}

export interface ContractorUnit {
  id: number;
  unit_code: string;
  unit_name: string;
  station_id: number | null;
  station_name: string | null;
  units_status: "active" | "expiring" | "inactive" | "inspection_pending";
}

export type UnitLocationType = "station" | "train" | "cluster";
export type UnitContractType = "earning" | "expenditure";
export type UnitDurationType = "long_term" | "short_term" | "temporary";

export interface Unit {
  id: number;
  unit_code: string;
  unit_name: string;
  location_type: UnitLocationType;
  station_id: number | null;
  station_name?: string | null;
  station_code?: string | null;
  train_id: number | null;
  train_name?: string | null;
  train_number?: string | null;
  cluster_id: number | null;
  cluster_display_name?: string | null;
  division_id?: number | null;
  division_name?: string | null;
  platform_location: string | null;
  // Legacy duration axis (long/short/temporary) — distinct from the UAT "Contract Type"
  // (earning/expenditure) below.
  duration_type: UnitDurationType | null;
  contract_type: UnitContractType | null;
  contract_category_id: number | null;
  contract_category_label?: string | null;
  area_description?: string | null;
  sketch_map_file?: string | null;
  contractor_id: number | null;
  contractor_name?: string | null;
  monthly_fee: number | null;
  units_status: "active" | "expiring" | "inactive" | "inspection_pending";
  inspector_name?: string | null;
}

export type VerificationStatus = "pending" | "verified" | "rejected" | "expired";
export type VendorDocumentType = "AADHAAR" | "MEDICAL" | "POLICE_VERIFICATION";
export type VendorType = "train_tsv" | "station_pf" | "station_stall" | "station_others";

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  train_tsv: "Train TSV",
  station_pf: "Station PF",
  station_stall: "Station Stall",
  station_others: "Station Others",
};

export interface Vendor {
  id: number;
  vendor_code: string;
  full_name: string;
  father_name: string | null;
  date_of_birth: string | null;
  aadhaar_number: string | null;
  mobile_number: string | null;
  address: string | null;
  profile_image: string | null;
  signature_path: string | null;
  vendor_type: VendorType;
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
  police_verification_status: VerificationStatus;
  police_verification_issue_date: string | null;
  police_verification_valid_till: string | null;
  police_verification_remarks: string | null;
  police_verification_document: string | null;
  medical_verification_status: VerificationStatus;
  medical_verification_issue_date: string | null;
  medical_verification_valid_till: string | null;
  medical_verification_remarks: string | null;
  medical_verification_document: string | null;
  card_number?: string | null;
  card_status?: string | null;
}

export interface VendorDocument {
  id: number;
  vendor_id: number;
  document_type: VendorDocumentType;
  document_path: string;
  original_name: string | null;
  uploaded_by: number | null;
  uploaded_by_name?: string | null;
  uploaded_at: string;
  status: number;
}

export type ComplaintSource = "railmadad" | "cpgrams" | "manual";

export type ComplaintStatus =
  | "pending"
  | "assigned"
  | "under_review"
  | "action_taken"
  | "approved"
  | "rejected"
  | "closed";

export interface ComplaintDocument {
  id: number;
  atr_id: number | null;
  document_type: "evidence" | "atr" | "other";
  file_name: string;
  original_name: string;
  file_path: string;
  file_type: string | null;
  uploaded_by: number | null;
  created_at: string;
}

export interface ComplaintAssignment {
  id: number;
  complaint_id: number;
  assignment_type: "initial" | "reassign" | "transfer";
  from_unit_id: number | null;
  from_unit_name?: string | null;
  to_unit_id: number | null;
  to_unit_name?: string | null;
  assigned_to_user_id: number | null;
  assigned_to_user_name?: string | null;
  assigned_by: number | null;
  assigned_by_name?: string | null;
  remarks: string | null;
  created_at: string;
}

export type AtrReviewStatus = "pending_review" | "sub_admin_reviewed" | "accepted" | "rejected" | "sent_back";

export interface ComplaintAtr {
  id: number;
  complaint_id: number;
  remarks: string;
  submitted_by: number | null;
  submitted_by_name?: string | null;
  submitted_at: string | null;
  review_status: AtrReviewStatus;
  reviewed_by: number | null;
  reviewed_by_name?: string | null;
  reviewed_at: string | null;
  review_remarks: string | null;
  decided_by: number | null;
  decided_by_name?: string | null;
  decided_at: string | null;
  decision_remarks: string | null;
  created_at: string;
}

export interface ComplaintStatusHistoryEntry {
  id: number;
  complaint_id: number;
  from_status: string | null;
  to_status: string;
  changed_by: number | null;
  changed_by_name?: string | null;
  remarks: string | null;
  created_at: string;
}

export interface ComplaintImportHistory {
  id: number;
  file_name: string;
  imported_by: number | null;
  imported_by_name?: string | null;
  total_records: number;
  imported_count: number;
  duplicate_count: number;
  failed_count: number;
  error_report: string | null;
  created_at: string;
}

export interface Complaint {
  id: number;
  complaint_code: string;
  complaint_source: ComplaintSource;
  complaint_ref_no: string | null;
  portal_registration_number: string | null;
  manual_dak_reference_number: string | null;
  eoffice_computer_number: string | null;
  unit_id: number | null;
  unit_name?: string | null;
  division_id: number | null;
  division_name?: string | null;
  train_id: number | null;
  train_name?: string | null;
  train_number?: string | null;
  station_id: number | null;
  station_name?: string | null;
  assigned_to_user_id: number | null;
  assigned_to_user_name?: string | null;
  location_text: string | null;
  complaint_type_id: number | null;
  complaint_type_label?: string | null;
  complaint_subtype_id: number | null;
  complaint_subtype_label?: string | null;
  description: string;
  complainant_name: string | null;
  complainant_mobile: string | null;
  complainant_email: string | null;
  occurrence_date: string | null;
  occurrence_time: string | null;
  complaint_date: string | null;
  resolution_date: string | null;
  priority: "low" | "medium" | "high";
  complaints_status: ComplaintStatus;
  registered_by_name?: string | null;
  closed_by_name?: string | null;
  closed_at: string | null;
  documents?: ComplaintDocument[];
  assignments?: ComplaintAssignment[];
  atrs?: ComplaintAtr[];
  statusHistory?: ComplaintStatusHistoryEntry[];
}

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

export interface InspectionDocument {
  id: number;
  atr_id: number | null;
  document_type: "inspection" | "atr" | "other";
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: number | null;
  created_at: string;
}

export interface InspectionAssignment {
  id: number;
  inspection_id: number;
  assignment_type: "initial" | "reassign" | "transfer";
  from_unit_id: number | null;
  from_unit_name?: string | null;
  to_unit_id: number | null;
  to_unit_name?: string | null;
  assigned_to_user_id: number | null;
  assigned_to_user_name?: string | null;
  assigned_by: number | null;
  assigned_by_name?: string | null;
  remarks: string | null;
  created_at: string;
}

export type InspectionAtrReviewStatus = "draft" | "pending_review" | "sub_admin_reviewed" | "accepted" | "rejected" | "sent_back";

export interface InspectionAtr {
  id: number;
  inspection_id: number;
  action_description: string;
  action_date: string | null;
  completion_status: "in_progress" | "partially_completed" | "completed";
  remarks: string | null;
  submitted_by: number | null;
  submitted_by_name?: string | null;
  submitted_at: string | null;
  review_status: InspectionAtrReviewStatus;
  reviewed_by: number | null;
  reviewed_by_name?: string | null;
  reviewed_at: string | null;
  review_remarks: string | null;
  decided_by: number | null;
  decided_by_name?: string | null;
  decided_at: string | null;
  decision_remarks: string | null;
  created_at: string;
}

export interface InspectionStatusHistoryEntry {
  id: number;
  inspection_id: number;
  from_status: string | null;
  to_status: string;
  changed_by: number | null;
  changed_by_name?: string | null;
  remarks: string | null;
  created_at: string;
}

export interface Inspection {
  id: number;
  inspection_no: string | null;
  unit_id: number | null;
  unit_name?: string | null;
  division_id: number | null;
  division_name?: string | null;
  station_id: number | null;
  station_name?: string | null;
  train_id: number | null;
  train_name?: string | null;
  train_number?: string | null;
  inspecting_official_name: string | null;
  designation: string | null;
  place_of_posting: string | null;
  inspection_category_id: number | null;
  inspection_category_label?: string | null;
  inspection_type_id: number | null;
  inspection_type_label?: string | null;
  inspection_date: string;
  observations: string | null;
  deficiencies: string | null;
  recommendations: string | null;
  remarks: string | null;
  priority: "low" | "medium" | "high";
  inspection_status: InspectionStatus;
  inspector_id: number | null;
  inspector_name?: string | null;
  assigned_to_user_id: number | null;
  assigned_to_user_name?: string | null;
  submitted_at: string | null;
  closed_by_name?: string | null;
  closed_at: string | null;
  documents?: InspectionDocument[];
  assignments?: InspectionAssignment[];
  atrs?: InspectionAtr[];
  statusHistory?: InspectionStatusHistoryEntry[];
}

export type PenaltyReferenceType = "complaint" | "inspection";
export type PenaltyApprovalStatus = "pending_approval" | "approved" | "rejected" | "revoked";
export type PenaltyRecoveryStatus = "pending" | "partially_recovered" | "recovered" | "closed";

export interface PenaltyDocument {
  id: number;
  penalty_id: number;
  document_path: string;
  original_name: string | null;
  uploaded_at: string;
}

export interface Penalty {
  id: number;
  penalty_code: string;
  reference_type: PenaltyReferenceType | null;
  complaint_id: number | null;
  complaint_code?: string | null;
  inspection_id: number | null;
  inspection_date?: string | null;
  contractor_id: number | null;
  contractor_name?: string | null;
  vendor_id: number | null;
  vendor_name?: string | null;
  unit_id: number | null;
  unit_name?: string | null;
  division_id?: number | null;
  division_name?: string | null;
  amount: number;
  reason: string;
  // Legacy 3-state column, kept in sync server-side — prefer approval_status/recovery_status.
  penalties_status: "pending" | "recovered" | "waived";
  approval_status: PenaltyApprovalStatus;
  approved_by_name?: string | null;
  approved_at?: string | null;
  revoked_by_name?: string | null;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  recovery_status: PenaltyRecoveryStatus;
  recovery_amount: number;
  due_date: string | null;
  recovery_date: string | null;
  mr_number?: string | null;
  mr_date?: string | null;
  order_number?: string | null;
  order_date?: string | null;
  remarks?: string | null;
  issued_date: string | null;
  issued_by_name?: string | null;
  resolution_date: string | null;
  documents?: PenaltyDocument[];
}

export interface PenaltyMetrics {
  totalCases: number;
  totalImposed: number;
  totalRecovered: number;
  outstandingAmount: number;
  overdueAmount: number;
  overdueCount: number;
  recoveryRate: number;
  pendingCategories: {
    within7Days: number;
    within14Days: number;
    within30Days: number;
    over30Days: number;
  };
  alerts: Array<{
    penalty_code: string;
    contractor_name: string | null;
    amount: number;
    reason: string;
    issued_date: string | null;
    due_date: string | null;
  }>;
}

export type CardTemplate = "template_a" | "template_b";
export type CardApprovalStatus = "draft" | "pending_approval" | "approved" | "rejected";
export type CardExpirySource = "medical" | "police_verification";

export const CARD_TEMPLATE_LABELS: Record<CardTemplate, string> = {
  template_a: "Template A — Portrait",
  template_b: "Template B — Landscape",
};

export interface IdCard {
  id: number;
  vendor_id: number;
  vendor_code: string;
  full_name: string;
  vendor_type: VendorType;
  unit_name: string | null;
  station_name: string | null;
  division_name: string | null;
  id_number: string | null;
  template: CardTemplate;
  issued_date: string | null;
  cards_status: "active" | "pending" | "expired";
  approval_status: CardApprovalStatus;
  requested_by_name?: string | null;
  requested_at?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  expiry_source?: CardExpirySource | null;
  expiry_date?: string | null;
  signature_applied?: boolean | number;
  pdf_path?: string | null;
  last_checked_at: string | null;
  validity_start?: string | null;
  validity_end?: string | null;
  police_verification_status?: string | null;
  police_verification_valid_till?: string | null;
  medical_verification_status?: string | null;
  medical_verification_valid_till?: string | null;
  contractor_name?: string | null;
}

export interface IdCardVerification {
  vendor_code: string;
  full_name: string;
  vendor_type: VendorType;
  address: string | null;
  aadhaar_number: string | null;
  contractor_name: string | null;
  unit_name: string | null;
  station_name: string | null;
  division_name: string | null;
  id_number: string;
  template: CardTemplate;
  cards_status: "active" | "pending" | "expired";
  approval_status: CardApprovalStatus;
  expiry_date: string | null;
  signature_applied: boolean | number;
  issued_date: string | null;
  last_checked_at: string | null;
  police_verification_status: string | null;
  police_verification_valid_till: string | null;
  medical_verification_status: string | null;
  medical_verification_valid_till: string | null;
  issuing_authority_name: string | null;
  issuing_authority_designation: string | null;
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

export type ReportFieldType = "string" | "number" | "date" | "enum" | "boolean";

export interface ReportFieldMeta {
  key: string;
  label: string;
  type: ReportFieldType;
  filterable: boolean;
  sortable: boolean;
  groupable: boolean;
  enumValues?: string[];
}

export interface ReportModuleMeta {
  key: string;
  label: string;
  fields: ReportFieldMeta[];
}

export type ReportFilterOperator = "eq" | "neq" | "like" | "gt" | "gte" | "lt" | "lte" | "between" | "in";

export interface ReportFilter {
  field: string;
  operator: ReportFilterOperator;
  value?: unknown;
  value2?: unknown;
}

export interface ReportSort {
  field: string;
  direction: "asc" | "desc";
}

export interface ReportTemplate {
  id: number;
  name: string;
  description: string | null;
  module_key: string;
  fields: string;
  filters: string | null;
  sort: string | null;
  group_by: string | null;
  aggregate_field?: string | null;
  is_shared: number;
  usage_count: number;
  last_used_at: string | null;
  created_by: number | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportExportEntry {
  id: number;
  report_template_id: number | null;
  template_name?: string | null;
  module_key: string;
  export_format: "xlsx" | "csv";
  filters_snapshot: string | null;
  row_count: number;
  file_name: string | null;
  exported_by: number | null;
  exported_by_name?: string | null;
  created_at: string;
}

export interface ImportableMaster {
  key: string;
  label: string;
  templateColumns: string[];
}

export interface ReportImportHistoryEntry {
  id: number;
  master_key: string;
  file_name: string;
  imported_by: number | null;
  imported_by_name?: string | null;
  total_records: number;
  imported_count: number;
  duplicate_count: number;
  failed_count: number;
  error_report: string | null;
  created_at: string;
}
