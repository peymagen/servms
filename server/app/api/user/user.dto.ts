import { type BaseSchema } from "../../common/dto/base.dto";

// JAG/SG apply to Admin-tier roles; Sr. Supervisor/JS/SS apply to Sub Admin-tier roles
// (per UAT doc). Card Signing Authority eligibility remains JS/SS-only regardless of role.
export type DesignationGrade = "JAG" | "SG" | "SR_SUPERVISOR" | "JS" | "SS" | "OTHER";

export interface IUser extends BaseSchema {
  employee_id: string;
  hrms_id?: string | null;
  username: string;
  full_name: string;
  designation?: string;
  designation_grade?: DesignationGrade | null;
  card_signing_authority?: boolean | number;
  email?: string;
  mobile?: string;
  password?: string; // mapped from password_hash
  password_hash?: string;
  is_temp_password?: boolean | number;
  role_id: number;
  role_name?: string;
  division_id?: number | null;
  zone_id?: number | null;
  station_id?: number | null;
  profile_image?: string;
  signature_path?: string | null;
  users_status?: "active" | "inactive" | "suspended" | "pending_approval";
  last_login_at?: Date;
}

export interface IUserCreate {
  employee_id: string;
  hrms_id?: string | null;
  username: string;
  full_name: string;
  designation?: string;
  designation_grade?: DesignationGrade | null;
  card_signing_authority?: boolean;
  email?: string;
  mobile?: string;
  password: string; // plain text
  role_id: number;
  division_id?: number | null;
  zone_id?: number | null;
  station_id?: number | null;
  profile_image?: string;
  signature_path?: string | null;
  users_status?: "active" | "inactive" | "suspended" | "pending_approval";
}

export interface IUserUpdate {
  employee_id?: string;
  hrms_id?: string | null;
  username?: string;
  full_name?: string;
  designation?: string;
  designation_grade?: DesignationGrade | null;
  card_signing_authority?: boolean;
  email?: string;
  mobile?: string;
  password?: string; // plain text if changing
  role_id?: number;
  division_id?: number | null;
  zone_id?: number | null;
  station_id?: number | null;
  profile_image?: string;
  signature_path?: string | null;
  users_status?: "active" | "inactive" | "suspended" | "pending_approval";
}