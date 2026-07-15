import { type BaseSchema } from "../../common/dto/base.dto";

export interface IUser extends BaseSchema {
  employee_id: string;
  username: string;
  full_name: string;
  designation?: string;
  email?: string;
  mobile?: string;
  password?: string; // mapped from password_hash
  password_hash?: string;
  role_id: number;
  division_id?: number;
  station_id?: number;
  profile_image?: string;
  users_status?: "active" | "inactive" | "suspended";
  last_login_at?: Date;
}

export interface IUserCreate {
  employee_id: string;
  username: string;
  full_name: string;
  designation?: string;
  email?: string;
  mobile?: string;
  password: string; // plain text
  role_id: number;
  division_id?: number;
  station_id?: number;
  profile_image?: string;
  users_status?: "active" | "inactive" | "suspended";
}

export interface IUserUpdate {
  employee_id?: string;
  username?: string;
  full_name?: string;
  designation?: string;
  email?: string;
  mobile?: string;
  password?: string; // plain text if changing
  role_id?: number;
  division_id?: number;
  station_id?: number;
  profile_image?: string;
  users_status?: "active" | "inactive" | "suspended";
}