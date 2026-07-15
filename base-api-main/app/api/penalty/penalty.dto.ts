import { type BaseSchema } from "../../common/dto/base.dto";

export interface IPenalty extends BaseSchema {
  penalty_code: string;
  contractor_id: number;
  vendor_id?: number;
  unit_id?: number;
  amount: number;
  reason: string;
  penalties_status: "pending" | "recovered" | "waived";
  issued_by?: number;
  issued_date?: string;
  resolution_date?: string;
  status?: number;
}

export interface IPenaltyCreate {
  contractor_id: number;
  vendor_id?: number;
  unit_id?: number;
  amount: number;
  reason: string;
  penalties_status?: "pending" | "recovered" | "waived";
  issued_date?: string;
}

export interface IPenaltyUpdate {
  penalties_status?: "pending" | "recovered" | "waived";
  amount?: number;
  reason?: string;
  resolution_date?: string;
}
