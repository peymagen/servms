import { type BaseSchema } from "../../common/dto/base.dto";

export type PenaltyReferenceType = "complaint" | "inspection";
export type PenaltyApprovalStatus = "pending_approval" | "approved" | "rejected" | "revoked";
export type PenaltyRecoveryStatus = "pending" | "partially_recovered" | "recovered" | "closed";
// "not_applicable" until a recovery entry actually reaches "recovered" (nothing to
// verify before then); "pending" once Dealing Section marks it fully recovered —
// an Admin/Divisional Admin must then verify the recovery documents before the
// record can move to recovery_status "closed" (see penalty.service.ts's verifyRecovery).
export type PenaltyRecoveryVerificationStatus = "not_applicable" | "pending" | "verified" | "rejected";
export type PenaltyDocumentType = "penalty_order" | "approval" | "recovery_receipt" | "other";

// Forward-only recovery workflow per UAT: Pending → Partially Recovered → Recovered → Closed.
export const RECOVERY_STATUS_ORDER: PenaltyRecoveryStatus[] = [
  "pending",
  "partially_recovered",
  "recovered",
  "closed",
];

export interface IPenalty extends BaseSchema {
  penalty_code: string;
  reference_type?: PenaltyReferenceType | null;
  complaint_id?: number | null;
  inspection_id?: number | null;
  contractor_id: number;
  vendor_id?: number | null;
  unit_id?: number | null;
  amount: number;
  reason: string;
  // Legacy 3-state column, kept auto-synced from approval_status/recovery_status so
  // existing consumers (e.g. dashboard.service.ts) keep working unchanged.
  penalties_status: "pending" | "recovered" | "waived";
  approval_status: PenaltyApprovalStatus;
  approved_by?: number | null;
  approved_at?: string | null;
  revoked_by?: number | null;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  recovery_status: PenaltyRecoveryStatus;
  recovery_amount: number;
  payment_reference?: string | null;
  recovery_verification_status: PenaltyRecoveryVerificationStatus;
  recovery_verified_by?: number | null;
  recovery_verified_at?: string | null;
  due_date?: string | null;
  recovery_date?: string | null;
  mr_number?: string | null;
  mr_date?: string | null;
  order_number?: string | null;
  order_date?: string | null;
  remarks?: string | null;
  issued_by?: number;
  issued_date?: string;
  resolution_date?: string | null;
  status?: number;
}

export interface IPenaltyCreate {
  reference_type?: PenaltyReferenceType;
  complaint_id?: number;
  inspection_id?: number;
  contractor_id: number;
  vendor_id?: number;
  unit_id?: number;
  amount: number;
  reason: string;
  due_date?: string;
  issued_date?: string;
}

export interface IPenaltyUpdate {
  amount?: number;
  reason?: string;
  due_date?: string;
  remarks?: string;
}

export interface IPenaltyRecoveryUpdate {
  recovery_status: PenaltyRecoveryStatus;
  recovery_amount?: number;
  recovery_date?: string;
  payment_reference?: string;
  mr_number?: string;
  mr_date?: string;
  order_number?: string;
  order_date?: string;
  remarks?: string;
}

// Captured at the moment of approval — "Penalty Imposition Date" is approved_at
// itself (set by the DB at approval time), not a separately-entered field.
export interface IPenaltyApprove {
  due_date?: string;
  order_number?: string;
  order_date?: string;
  remarks?: string;
}

export interface IPenaltyRecoveryVerify {
  decision: "verified" | "rejected";
  remarks?: string;
}

export interface IPenaltyFilters {
  search?: string;
  division_id?: number;
  contractor_id?: number;
  vendor_id?: number;
  approval_status?: PenaltyApprovalStatus;
  recovery_status?: PenaltyRecoveryStatus;
  penalty_date_from?: string;
  penalty_date_to?: string;
  due_date_from?: string;
  due_date_to?: string;
  limit?: number;
  offset?: number;
}
