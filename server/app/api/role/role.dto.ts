import { type BaseSchema } from "../../common/dto/base.dto";

export const MODULE_NAMES = [
  "vendor_management",
  "unit_masters",
  "contractor_database",
  "qr_issuance",
  "complaints_grievances",
  "penalties_fines",
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
