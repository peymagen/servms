import * as userService from "./user.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import passport from "passport";
import { createUserTokens } from "../../common/services/passport-jwt.service";
import bcrypt from "bcrypt";

// ─── Helper ────────────────────────────────────────────────────────────────────
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

// ─── CREATE USER ───────────────────────────────────────────────────────────────
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  req.body.password = await hashPassword(req.body.password); // ✅ await fixed
  const result = await userService.createUser(req.body);
  res.send(createResponse(result, "User created successfully"));
});

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  console.log("Login attempt for username:", req.body); // Debug log
  passport.authenticate(
    "login",
    async (err: Error | null, user: any | undefined, info: any) => {
      if (err || !user) {
        return res.status(401).json({
          message: info?.message || "Authentication failed",
        });
      }
      // Update last_login timestamp on successful login
      await userService.updateLastLogin(user.id);
      const { accessToken } = createUserTokens(user);
      res.send(createResponse({ accessToken, user }, "Login successful"));
    }
  )(req, res);
});

// ─── FULL UPDATE (PUT) ─────────────────────────────────────────────────────────
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.password) {
    req.body.password = await hashPassword(req.body.password); // ✅ await fixed
  }
  const result = await userService.updateUser(req.params.id, req.body);
  res.send(createResponse(result, "User updated successfully"));
});

// ─── PARTIAL UPDATE (PATCH) ────────────────────────────────────────────────────
export const editUser = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.password) {
    // Hash and store under the correct column name before passing to service
    req.body.password_hash = await hashPassword(req.body.password); // ✅ await fixed
    delete req.body.password;
  }
  const result = await userService.editUser(req.params.id, req.body);
  res.send(createResponse(result, "User patched successfully"));
});

// ─── DELETE ────────────────────────────────────────────────────────────────────
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.deleteUser(req.params.id);
  res.send(createResponse(result, "User deleted successfully"));
});

// ─── GET BY ID ─────────────────────────────────────────────────────────────────
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.getUserById(req.params.id);
  if (!result) {
    res.status(404).send(createResponse(null, "User not found"));
    return;
  }
  res.send(createResponse(result));
});

// ─── GET ALL ───────────────────────────────────────────────────────────────────
export const getAllUser = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const divisionId = user?.role_name === "admin" ? user.division_id : undefined;
  const result = await userService.getAllUsers(divisionId);
  res.send(createResponse(result));
});

// ─── TOGGLE STATUS ─────────────────────────────────────────────────────────────
export const toggleStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.toggleStatus(req.params.id);
  res.send(createResponse(result, "User status toggled successfully"));
});

// ─── CHANGE PASSWORD ───────────────────────────────────────────────────────────
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = await userService.getUserById(req.params.id);
  if (!user) {
    res.status(404).send(createResponse(null, "User not found"));
    return;
  }
  const dbUser = await userService.getUserByUsername((user as any).username);
  if (!dbUser) {
    res.status(404).send(createResponse(null, "User details not found"));
    return;
  }
  const isMatch = await bcrypt.compare(currentPassword, (dbUser as any).password_hash);
  if (!isMatch) {
    res.status(400).send(createResponse(null, "Current password is incorrect"));
    return;
  }
  const newHash = await hashPassword(newPassword);
  const result = await userService.changePassword(req.params.id, newHash);
  res.send(createResponse(result, "Password changed successfully"));
});