import { type ModuleName } from "../role/role.dto";

// ─────────────────────────────────────────────────────────────────────────
// WHITELISTED REPORT REGISTRY
//
// The Custom Report Builder lets a user pick a "module" and "fields"
// dynamically — but never as raw table/column names from client input. Every
// reportable module and every field it exposes is defined here, server-side,
// ahead of time. The report service only ever accepts *field keys* from the
// client, looks them up against this registry, and uses the registry's own
// safe SQL column expression. User input never reaches a SQL identifier
// position — only ever a bound parameter value. This is the load-bearing
// security boundary for the whole module: extend this file to add a
// reportable module/field, never build column/table names from request data.
// ─────────────────────────────────────────────────────────────────────────

export type ReportFieldType = "string" | "number" | "date" | "enum" | "boolean";

export interface ReportField {
  key: string;
  label: string;
  column: string; // safe, server-authored SQL expression (never derived from user input)
  type: ReportFieldType;
  filterable?: boolean;
  sortable?: boolean;
  groupable?: boolean;
  enumValues?: string[];
}

export interface ReportModuleDef {
  key: string;
  label: string;
  permissionModule: ModuleName;
  baseQuery: string; // "FROM ... LEFT JOIN ..." — safe, hardcoded
  statusColumn?: string; // soft-delete guard, e.g. "v.status = 1"
  divisionColumn?: string; // safe expression used for division-scoping
  fields: ReportField[];
}

const f = (
  key: string,
  label: string,
  column: string,
  type: ReportFieldType,
  opts: Partial<Pick<ReportField, "filterable" | "sortable" | "groupable" | "enumValues">> = {}
): ReportField => ({
  key,
  label,
  column,
  type,
  filterable: opts.filterable ?? true,
  sortable: opts.sortable ?? true,
  groupable: opts.groupable ?? (type === "enum" || type === "boolean"),
  enumValues: opts.enumValues,
});

const REGISTRY: ReportModuleDef[] = [
  {
    key: "vendors",
    label: "Vendors",
    permissionModule: "vendor_management",
    baseQuery: `FROM vendors v
      LEFT JOIN contractors c ON c.id = v.contractor_id
      LEFT JOIN units u ON u.id = v.unit_id
      LEFT JOIN stations st ON st.id = v.station_id
      LEFT JOIN divisions d ON d.id = v.division_id`,
    statusColumn: "v.status = 1",
    divisionColumn: "v.division_id",
    fields: [
      f("id", "ID", "v.id", "number", { groupable: false }),
      f("vendor_code", "Vendor Code", "v.vendor_code", "string"),
      f("full_name", "Full Name", "v.full_name", "string"),
      f("mobile_number", "Mobile Number", "v.mobile_number", "string", { groupable: false }),
      f("vendor_type", "Vendor Type", "v.vendor_type", "enum", {
        enumValues: ["train_tsv", "station_pf", "station_stall", "station_others"],
      }),
      f("vendor_status", "Status", "v.vendor_status", "enum", { enumValues: ["active", "pending", "expired"] }),
      f("police_verification_status", "Police Verification", "v.police_verification_status", "enum", {
        enumValues: ["pending", "verified", "rejected", "expired"],
      }),
      f("medical_verification_status", "Medical Verification", "v.medical_verification_status", "enum", {
        enumValues: ["pending", "verified", "rejected", "expired"],
      }),
      f("validity_start", "Validity Start", "v.validity_start", "date"),
      f("validity_end", "Validity End", "v.validity_end", "date"),
      f("contractor_name", "Contractor", "c.company_name", "string"),
      f("unit_name", "Unit", "u.unit_name", "string"),
      f("station_name", "Station", "st.station_name", "string"),
      f("division_name", "Division", "d.division_name", "string"),
      f("division_id", "Division", "v.division_id", "number", { filterable: true, groupable: false, sortable: false }),
      f("created_by", "Created By (User ID)", "v.created_by", "number", { groupable: false }),
      f("created_at", "Created On", "v.created_at", "date"),
    ],
  },
  {
    key: "contractors",
    label: "Contractors",
    permissionModule: "contractor_management",
    baseQuery: `FROM contractors c LEFT JOIN divisions d ON d.id = c.division_id`,
    statusColumn: "c.status = 1",
    divisionColumn: "c.division_id",
    fields: [
      f("id", "ID", "c.id", "number", { groupable: false }),
      f("contractor_code", "Contractor Code", "c.contractor_code", "string"),
      f("company_name", "Company Name", "c.company_name", "string"),
      f("primary_contact_name", "Primary Contact", "c.primary_contact_name", "string"),
      f("primary_contact_mobile", "Contact Mobile", "c.primary_contact_mobile", "string", { groupable: false }),
      f("pan_number", "PAN", "c.pan_number", "string", { groupable: false }),
      f("gstin", "GSTIN", "c.gstin", "string", { groupable: false }),
      f("license_number", "License Number", "c.license_number", "string", { groupable: false }),
      f("license_validity_date", "License Validity", "c.license_validity_date", "date"),
      f("contractors_status", "Status", "c.contractors_status", "enum", {
        enumValues: ["active", "pending_approval", "suspended", "expired"],
      }),
      f("fee_status", "Fee Status", "c.fee_status", "enum", { enumValues: ["paid", "overdue"] }),
      f("annual_contract_value", "Annual Contract Value", "c.annual_contract_value", "number"),
      f("compliance_rate", "Compliance Rate", "c.compliance_rate", "number"),
      f("division_name", "Division", "d.division_name", "string"),
      f("division_id", "Division", "c.division_id", "number", { filterable: true, groupable: false, sortable: false }),
      f("created_by", "Created By (User ID)", "c.created_by", "number", { groupable: false }),
      f("created_at", "Created On", "c.created_at", "date"),
    ],
  },
  {
    key: "units",
    label: "Units",
    permissionModule: "unit_management",
    baseQuery: `FROM units u
      LEFT JOIN stations st ON st.id = u.station_id
      LEFT JOIN trains tr ON tr.id = u.train_id
      LEFT JOIN location_clusters cl ON cl.id = u.cluster_id
      LEFT JOIN divisions d ON d.id = COALESCE(st.division_id, tr.division_id, cl.division_id)
      LEFT JOIN contractors ct ON ct.id = u.contractor_id`,
    divisionColumn: "COALESCE(st.division_id, tr.division_id, cl.division_id)",
    fields: [
      f("id", "ID", "u.id", "number", { groupable: false }),
      f("unit_code", "Unit Code", "u.unit_code", "string"),
      f("unit_name", "Unit Name", "u.unit_name", "string"),
      f("location_type", "Location Type", "u.location_type", "enum", { enumValues: ["station", "train", "cluster"] }),
      f("units_status", "Status", "u.units_status", "enum", {
        enumValues: ["active", "expiring", "inactive", "inspection_pending"],
      }),
      f("contract_type", "Contract Type", "u.contract_type", "enum", { enumValues: ["earning", "expenditure"] }),
      f("duration_type", "Duration Type", "u.duration_type", "enum", {
        enumValues: ["long_term", "short_term", "temporary"],
      }),
      f("annual_fee", "Annual Fee", "u.annual_fee", "number"),
      f("station_name", "Station", "st.station_name", "string"),
      f("train_number", "Train No.", "tr.train_number", "string"),
      f("contractor_name", "Contractor", "ct.company_name", "string"),
      f("division_name", "Division", "d.division_name", "string"),
      f("division_id", "Division", "COALESCE(st.division_id, tr.division_id, cl.division_id)", "number", {
        filterable: true,
        groupable: false,
        sortable: false,
      }),
      f("license_period_start", "License Start", "u.license_period_start", "date"),
      f("license_period_end", "License End", "u.license_period_end", "date"),
      f("created_by", "Created By (User ID)", "u.created_by", "number", { groupable: false }),
      f("created_at", "Created On", "u.created_at", "date"),
    ],
  },
  {
    key: "penalties",
    label: "Penalties",
    permissionModule: "penalty_management",
    baseQuery: `FROM penalties p
      LEFT JOIN contractors c ON c.id = p.contractor_id
      LEFT JOIN vendors v ON v.id = p.vendor_id
      LEFT JOIN units u ON u.id = p.unit_id
      LEFT JOIN stations st ON st.id = u.station_id
      LEFT JOIN divisions d ON d.id = st.division_id`,
    statusColumn: "p.status = 1",
    divisionColumn: "st.division_id",
    fields: [
      f("id", "ID", "p.id", "number", { groupable: false }),
      f("penalty_code", "Penalty Code", "p.penalty_code", "string"),
      f("reference_type", "Reference Type", "p.reference_type", "enum", { enumValues: ["complaint", "inspection"] }),
      f("amount", "Amount", "p.amount", "number"),
      f("penalties_status", "Status (Legacy)", "p.penalties_status", "enum", {
        enumValues: ["pending", "recovered", "waived"],
      }),
      f("approval_status", "Approval Status", "p.approval_status", "enum", {
        enumValues: ["pending_approval", "approved", "rejected", "revoked"],
      }),
      f("recovery_status", "Recovery Status", "p.recovery_status", "enum", {
        enumValues: ["pending", "partially_recovered", "recovered", "closed"],
      }),
      f("recovery_amount", "Recovery Amount", "p.recovery_amount", "number"),
      f("due_date", "Due Date", "p.due_date", "date"),
      f("recovery_date", "Recovery Date", "p.recovery_date", "date"),
      f("issued_date", "Issued Date", "p.issued_date", "date"),
      f("contractor_name", "Contractor", "c.company_name", "string"),
      f("vendor_name", "Vendor", "v.full_name", "string"),
      f("unit_name", "Unit", "u.unit_name", "string"),
      f("division_name", "Division", "d.division_name", "string"),
      f("division_id", "Division", "st.division_id", "number", { filterable: true, groupable: false, sortable: false }),
      f("created_at", "Created On", "p.created_at", "date"),
    ],
  },
  {
    key: "idcards",
    label: "ID Cards",
    permissionModule: "id_card_management",
    baseQuery: `FROM vendor_id_cards ic
      LEFT JOIN vendors v ON v.id = ic.vendor_id
      LEFT JOIN contractors c ON c.id = v.contractor_id
      LEFT JOIN divisions d ON d.id = v.division_id`,
    statusColumn: "ic.status = 1",
    divisionColumn: "v.division_id",
    fields: [
      f("id", "ID", "ic.id", "number", { groupable: false }),
      f("id_number", "ID Number", "ic.id_number", "string"),
      f("template", "Template", "ic.template", "enum", { enumValues: ["template_a", "template_b"] }),
      f("cards_status", "Status", "ic.cards_status", "enum", { enumValues: ["active", "pending", "expired"] }),
      f("approval_status", "Approval Status", "ic.approval_status", "enum", {
        enumValues: ["draft", "pending_approval", "approved", "rejected"],
      }),
      f("issued_date", "Issued Date", "ic.issued_date", "date"),
      f("expiry_date", "Expiry Date", "ic.expiry_date", "date"),
      f("vendor_name", "Vendor", "v.full_name", "string"),
      f("vendor_code", "Vendor Code", "v.vendor_code", "string"),
      f("contractor_name", "Contractor", "c.company_name", "string"),
      f("division_name", "Division", "d.division_name", "string"),
      f("division_id", "Division", "v.division_id", "number", { filterable: true, groupable: false, sortable: false }),
      f("created_at", "Created On", "ic.created_at", "date"),
    ],
  },
  {
    key: "users",
    label: "Users",
    permissionModule: "user_management",
    // Deliberately excludes password_hash, signature_path, profile_image —
    // never expose credential/identity-document fields through a generic
    // reporting surface, even to HQ Admin.
    baseQuery: `FROM users us LEFT JOIN roles r ON r.id = us.role_id LEFT JOIN divisions d ON d.id = us.division_id`,
    statusColumn: "us.status = 1",
    divisionColumn: "us.division_id",
    fields: [
      f("id", "ID", "us.id", "number", { groupable: false }),
      f("employee_id", "Employee ID", "us.employee_id", "string"),
      f("username", "Username", "us.username", "string"),
      f("full_name", "Full Name", "us.full_name", "string"),
      f("designation", "Designation", "us.designation", "string"),
      f("email", "Email", "us.email", "string", { groupable: false }),
      f("mobile", "Mobile", "us.mobile", "string", { groupable: false }),
      f("role_name", "Role", "r.role_name", "string"),
      f("users_status", "Status", "us.users_status", "enum", {
        enumValues: ["active", "inactive", "suspended", "pending_approval"],
      }),
      f("division_name", "Division", "d.division_name", "string"),
      f("division_id", "Division", "us.division_id", "number", { filterable: true, groupable: false, sortable: false }),
      f("last_login_at", "Last Login", "us.last_login_at", "date"),
      f("created_at", "Created On", "us.created_at", "date"),
    ],
  },
  {
    key: "complaints",
    label: "Complaints",
    permissionModule: "complaint_management",
    baseQuery: `FROM complaints cp
      LEFT JOIN units u ON u.id = cp.unit_id
      LEFT JOIN divisions d ON d.id = cp.division_id
      LEFT JOIN dropdown_options ct ON ct.id = cp.complaint_type_id`,
    statusColumn: "cp.status = 1",
    divisionColumn: "cp.division_id",
    fields: [
      f("id", "ID", "cp.id", "number", { groupable: false }),
      f("complaint_code", "Complaint Code", "cp.complaint_code", "string"),
      f("complaint_source", "Source", "cp.complaint_source", "enum", {
        enumValues: ["railmadad", "cpgrams", "manual"],
      }),
      f("complaint_type", "Complaint Type", "ct.label", "string"),
      f("priority", "Priority", "cp.priority", "enum", { enumValues: ["low", "medium", "high"] }),
      f("complaints_status", "Status", "cp.complaints_status", "enum", {
        enumValues: ["pending", "assigned", "under_review", "action_taken", "approved", "rejected", "closed"],
      }),
      f("complaint_date", "Complaint Date", "cp.complaint_date", "date"),
      f("unit_name", "Unit", "u.unit_name", "string"),
      f("division_name", "Division", "d.division_name", "string"),
      f("division_id", "Division", "cp.division_id", "number", { filterable: true, groupable: false, sortable: false }),
      f("closed_at", "Closed On", "cp.closed_at", "date"),
    ],
  },
  {
    key: "inspections",
    label: "Inspections",
    permissionModule: "inspection_management",
    baseQuery: `FROM inspections ins
      LEFT JOIN units u ON u.id = ins.unit_id
      LEFT JOIN divisions d ON d.id = ins.division_id
      LEFT JOIN dropdown_options ic ON ic.id = ins.inspection_category_id
      LEFT JOIN users insp ON insp.id = ins.inspector_id`,
    statusColumn: "ins.status = 1",
    divisionColumn: "ins.division_id",
    fields: [
      f("id", "ID", "ins.id", "number", { groupable: false }),
      f("inspection_no", "Inspection No.", "ins.inspection_no", "string"),
      f("inspection_category", "Category", "ic.label", "string"),
      f("inspecting_official_name", "Inspecting Official", "ins.inspecting_official_name", "string"),
      f("priority", "Priority", "ins.priority", "enum", { enumValues: ["low", "medium", "high"] }),
      f("inspection_status", "Status", "ins.inspection_status", "enum", {
        enumValues: ["draft", "submitted", "returned", "assigned", "atr_submitted", "under_review", "approved", "rejected", "closed"],
      }),
      f("inspection_date", "Inspection Date", "ins.inspection_date", "date"),
      f("unit_name", "Unit", "u.unit_name", "string"),
      f("inspector_name", "Inspector", "insp.full_name", "string"),
      f("division_name", "Division", "d.division_name", "string"),
      f("division_id", "Division", "ins.division_id", "number", { filterable: true, groupable: false, sortable: false }),
      f("closed_at", "Closed On", "ins.closed_at", "date"),
    ],
  },
];

export const getReportModule = (key: string): ReportModuleDef | undefined => REGISTRY.find((m) => m.key === key);

export const listReportModules = (): ReportModuleDef[] => REGISTRY;

export const getReportField = (moduleDef: ReportModuleDef, fieldKey: string): ReportField | undefined =>
  moduleDef.fields.find((field) => field.key === fieldKey);
