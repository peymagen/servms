import jwt from "jsonwebtoken";
import { Division, Role } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET ?? "servms-dev-secret-change-me";

export interface AuthTokenPayload {
  sub: string;
  employeeId: string;
  role: Role;
  division: Division | null;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
