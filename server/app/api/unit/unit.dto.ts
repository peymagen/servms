import { type BaseSchema } from "../../common/dto/base.dto";

export type UnitLocationType = "station" | "train" | "cluster";
export type UnitContractType = "earning" | "expenditure";
export type UnitDurationType = "long_term" | "short_term" | "temporary";
export type UnitStatus = "active" | "expiring" | "inactive" | "inspection_pending";

export interface IUnit extends BaseSchema {
  unit_code: string;
  unit_name: string;
  location_type: UnitLocationType;
  station_id?: number | null;
  train_id?: number | null;
  cluster_id?: number | null;
  platform_location?: string | null;
  duration_type?: UnitDurationType | null;
  contract_type?: UnitContractType | null;
  contract_category_id?: number | null;
  area_description?: string | null;
  sketch_map_file?: string | null;
  contractor_id?: number | null;
  annual_fee?: number | null;
  license_period_start?: string | null;
  license_period_end?: string | null;
  units_status?: UnitStatus;
  created_by?: number;
}

export interface IUnitCreate {
  unit_code: string;
  unit_name: string;
  location_type: UnitLocationType;
  station_id?: number;
  train_id?: number;
  cluster_id?: number;
  platform_location?: string;
  duration_type?: UnitDurationType;
  contract_type?: UnitContractType;
  contract_category_id?: number;
  area_description?: string;
  sketch_map_file?: string;
  contractor_id?: number;
  annual_fee?: number;
  license_period_start?: string;
  license_period_end?: string;
  units_status?: UnitStatus;
}

export type IUnitUpdate = Partial<IUnitCreate>;
