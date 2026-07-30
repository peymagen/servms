import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import passport from "passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import { Strategy as LocalStrategy } from "passport-local";
import createError from "http-errors";
import * as userService from "../../api/user/user.service";
import { type Request } from "express";
import { type IUser } from "../../api/user/user.dto";

const isValidPassword = async function (value: string, password: string) {
  const compare = await bcrypt.compare(value, password);
  return compare;
};

export const initPassport = (): void => {
  passport.use(
    new Strategy(
      {
        secretOrKey: process.env.JWT_SECRET ?? "",
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      },
      async (token: { user: Request["user"] }, done) => {
        try {
          done(null, token.user);
        } catch (error) {
          done(error);
        }
      }
    )
  );

  // user login — using username + password
  passport.use(
    "login",
    new LocalStrategy(
      {
        usernameField: "username",   // ← changed from "email" to "username"
        passwordField: "password",
      },
      async (username, password, done) => {
        try {

          const dbUser = await userService.getUserByUsername(username);
          console.log("Database user found:", dbUser); // Debug log
          if (!dbUser) {
            done(null, false, { message: "User not found!" });
            return;
          }

          const user = dbUser as IUser;

          // password_hash is the actual stored password
          const storedPassword = (user as any).password_hash ?? user.password ?? "";

          const validate = await isValidPassword(password, storedPassword);
          if (!validate) {
            done(null, false, { message: "Invalid username or password" });
            return;
          }

          // Remove password fields before returning user
          const { password: _p, ...result } = user as any;
          delete result.password_hash;

          done(null, result, { message: "Logged in Successfully" });
        } catch (error: any) {
          done(createError(500, error.message));
        }
      }
    )
  );
};

export const createUserTokens = (user: Omit<IUser, "password">) => {
  const jwtSecret = process.env.JWT_SECRET ?? "";
  const token = jwt.sign(user, jwtSecret, { expiresIn: "12h" });
  return { accessToken: token, refreshToken: "" };
};

export const decodeToken = (token: string) => {
  const decode = jwt.decode(token);
  return decode as IUser;
};