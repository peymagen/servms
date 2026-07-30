import { type BaseSchema } from "../../common/dto/base.dto";

export interface ITrain extends BaseSchema {
  division_id: number;
  train_number: string;
  train_name: string;
  source: string;
  destination: string;
  opposite_train_number?: string | null;
  opposite_train_name?: string | null;
  opposite_source?: string | null;
  opposite_destination?: string | null;
  created_by?: number;
  status?: number;
}

export interface ITrainCreate {
  division_id: number;
  train_number: string;
  train_name: string;
  source: string;
  destination: string;
  opposite_train_number?: string;
  opposite_train_name?: string;
  opposite_source?: string;
  opposite_destination?: string;
}

export type ITrainUpdate = Partial<ITrainCreate>;
