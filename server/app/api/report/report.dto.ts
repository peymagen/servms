export type ReportFilterOperator = "eq" | "neq" | "like" | "gt" | "gte" | "lt" | "lte" | "between" | "in";

export interface ReportFilterInput {
  field: string;
  operator: ReportFilterOperator;
  value?: unknown;
  value2?: unknown;
}

export interface ReportSortInput {
  field: string;
  direction: "asc" | "desc";
}

export interface GenerateReportInput {
  module_key: string;
  fields: string[];
  filters?: ReportFilterInput[];
  sort?: ReportSortInput;
  group_by?: string[];
  aggregate_field?: string;
  limit?: number;
  offset?: number;
}

export interface ReportTemplateCreate {
  name: string;
  description?: string;
  module_key: string;
  fields: string[];
  filters?: ReportFilterInput[];
  sort?: ReportSortInput;
  group_by?: string[];
  aggregate_field?: string;
  is_shared?: boolean;
}

export interface ReportTemplateUpdate {
  name?: string;
  description?: string;
  fields?: string[];
  filters?: ReportFilterInput[];
  sort?: ReportSortInput;
  group_by?: string[];
  aggregate_field?: string;
  is_shared?: boolean;
}
