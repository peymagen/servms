import { api } from "./client";
import type { AuthUser } from "../types";

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export function login(employeeId: string, password: string) {
  return api.post<LoginResponse>("/auth/login", { employeeId, password });
}

export function fetchMe() {
  return api.get<AuthUser>("/auth/me");
}
