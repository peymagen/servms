import { type BaseSchema } from "../../common/dto/base.dto";

export interface IComplaint extends BaseSchema {
  complaint_code: string;
  unit_id: number;
  location_text?: string;
  category: string;
  description: string;
  occurrence_date?: string;
  occurrence_time?: string;
  priority: "low" | "medium" | "high";
  complaints_status: "open" | "investigating" | "resolved" | "rejected";
  registered_by?: number;
  status?: number;
}

export interface IComplaintCreate {
  unit_id: number;
  location_text?: string;
  category: string;
  description: string;
  occurrence_date?: string;
  occurrence_time?: string;
  priority?: "low" | "medium" | "high";
  complaints_status?: "open" | "investigating" | "resolved" | "rejected";
}

export interface IComplaintUpdate {
  location_text?: string;
  category?: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  complaints_status?: "open" | "investigating" | "resolved" | "rejected";
}
