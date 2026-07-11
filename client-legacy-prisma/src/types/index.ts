export type Role = "SUPER_ADMIN" | "ADMIN" | "DIVISION_ADDITIONAL_ADMIN";

export type Division = "ADRA" | "RANCHI" | "CHAKRADHARPUR" | "KHARAGPUR";

export type UserStatus = "ACTIVE" | "INACTIVE";

export interface AuthUser {
  id: string;
  employeeId: string;
  fullName: string;
  designation: string | null;
  role: Role;
  division: Division | null;
}

export interface ManagedUser extends AuthUser {
  email: string | null;
  status: UserStatus;
  lastLogin: string | null;
  createdAt: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  DIVISION_ADDITIONAL_ADMIN: "Division Additional Admin",
};

export const DIVISION_LABELS: Record<Division, string> = {
  ADRA: "Adra",
  RANCHI: "Ranchi",
  CHAKRADHARPUR: "Chakradharpur",
  KHARAGPUR: "Kharagpur",
};

export type FeeStatus = "PAID" | "OVERDUE";
export type ContractorStatus = "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED";
export type AadhaarStatus = "VERIFIED" | "PENDING";
export type VendorStatus = "ACTIVE" | "EXPIRED" | "INACTIVE";

export interface Contractor {
  id: string;
  name: string;
  licenseNumber: string;
  division: Division;
  validityDate: string;
  feeStatus: FeeStatus;
  status: ContractorStatus;
  _count: { vendors: number };
}

export type IdCardStatus = "NOT_ISSUED" | "ACTIVE" | "EXPIRED";

export interface Vendor {
  id: string;
  vendorCode: string;
  fullName: string;
  contractorId: string;
  contractor: { name: string; licenseNumber: string };
  division: Division;
  unitStation: string;
  vendorType: string;
  mobileNumber: string | null;
  email: string | null;
  aadhaarStatus: AadhaarStatus;
  medicalValidity: string | null;
  status: VendorStatus;
  idCardStatus: IdCardStatus;
  idCardIssuedAt: string | null;
}

export type UnitStatus = "ACTIVE" | "EXPIRING" | "INACTIVE" | "PENDING";

export interface Unit {
  id: string;
  station: string;
  platformLocation: string | null;
  division: Division;
  clusterName: string | null;
  contractType: string | null;
  contractCategory: string | null;
  unitName: string;
  unitCode: string;
  areaDescription: string | null;
  inspectorName: string | null;
  status: UnitStatus;
  createdAt: string;
}

export type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH";
export type ComplaintStatus = "PENDING" | "UNDER_INVESTIGATION" | "RESOLVED";

export interface Complaint {
  id: string;
  unitStation: string;
  category: string;
  description: string;
  division: Division;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  occurrenceDate: string | null;
  createdAt: string;
}

export type PenaltyStatus = "PENDING" | "RECOVERED" | "OVERDUE";

export interface Penalty {
  id: string;
  refNo: string;
  vendorId: string | null;
  vendorName: string;
  unitLocation: string;
  division: Division;
  penaltyType: string;
  amount: number;
  status: PenaltyStatus;
  createdAt: string;
}

export interface ReportsSummary {
  totalUsers: number;
  totalContractors: number;
  totalVendors: number;
  totalUnits: number;
  complaintsByStatus: Array<{ status: ComplaintStatus; count: number }>;
  totalPenaltyAmount: number;
  totalRecoveredAmount: number;
}
