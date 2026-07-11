import { api } from "./client";
import type { Contractor, Division, Role, Station } from "../types";

export const getDivisions = () => api.get<Division[]>("/masters/divisions");
export const getStations = (divisionId?: number) =>
  api.get<Station[]>(`/masters/stations${divisionId ? `?division_id=${divisionId}` : ""}`);
export const getContractorsLite = () => api.get<Contractor[]>("/masters/contractors");
export const getRolesLite = () => api.get<Role[]>("/masters/roles");
