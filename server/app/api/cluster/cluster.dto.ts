import { type BaseSchema } from "../../common/dto/base.dto";

export type ClusterType = "station" | "train";

export interface ICluster extends BaseSchema {
  division_id: number;
  cluster_name: string;
  cluster_type: ClusterType;
  created_by?: number;
  status?: number;
}

export interface IClusterCreate {
  division_id: number;
  cluster_name: string;
  cluster_type: ClusterType;
  // Station IDs (cluster_type = 'station') or Train IDs (cluster_type = 'train') — never both.
  member_ids: number[];
}

export interface IClusterUpdate {
  cluster_name?: string;
  member_ids?: number[];
}
