import { type BaseSchema } from "../../common/dto/base.dto";

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

export interface IRole extends BaseSchema {
  role_name: string;
  description?: string;
  roles_status?: "active" | "inactive";
}

export interface IRolePermission extends BaseSchema {
  role_id: number;
  module_name: ModuleName;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve_reject: boolean;
  can_export: boolean;
}
