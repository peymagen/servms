import { api } from "./client";
import type { AuthUser } from "../types";

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export function login(username: string, password: string) {
  return api.post<LoginResponse>("/users/login", { username, password });
}
