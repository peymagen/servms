import { type BaseSchema } from "../../common/dto/base.dto";

export interface IUnit extends BaseSchema {
  unit_code: string;
  unit_name: string;
  station_id: number;
  platform_location?: string;
  cluster_name?: string;
  contract_type?: "long_term" | "short_term" | "temporary";
  contract_category?: string;
  area_description?: string;
  sketch_map_file?: string;
  contractor_id?: number;
  monthly_fee?: number;
  license_period_start?: string;
  license_period_end?: string;
  units_status?: "active" | "expiring" | "inactive" | "inspection_pending";
  created_by?: number;
}

export interface IUnitCreate {
  unit_code: string;
  unit_name: string;
  station_id: number;
  platform_location?: string;
  cluster_name?: string;
  contract_type?: "long_term" | "short_term" | "temporary";
  contract_category?: string;
  area_description?: string;
  sketch_map_file?: string;
  contractor_id?: number;
  monthly_fee?: number;
  license_period_start?: string;
  license_period_end?: string;
  units_status?: "active" | "expiring" | "inactive" | "inspection_pending";
}

export interface IUnitUpdate {
  unit_code?: string;
  unit_name?: string;
  station_id?: number;
  platform_location?: string;
  cluster_name?: string;
  contract_type?: "long_term" | "short_term" | "temporary";
  contract_category?: string;
  area_description?: string;
  sketch_map_file?: string;
  contractor_id?: number;
  monthly_fee?: number;
  license_period_start?: string;
  license_period_end?: string;
  units_status?: "active" | "expiring" | "inactive" | "inspection_pending";
}
