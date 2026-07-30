import { type BaseSchema } from "../../common/dto/base.dto";

export interface IDropdownOption extends BaseSchema {
  category: string;
  parent_id: number | null;
  division_id: number | null;
  value: string;
  label: string;
  sort_order: number;
  created_by?: number;
  status?: number;
}

export interface IDropdownOptionCreate {
  category: string;
  parent_id?: number | null;
  division_id?: number | null;
  value: string;
  label: string;
  sort_order?: number;
}

export interface IDropdownOptionUpdate {
  label?: string;
  sort_order?: number;
}
