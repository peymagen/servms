import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthUser } from "../types";

interface AuthState {
  user: AuthUser | null;
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("servms_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

const initialState: AuthState = {
  user: readStoredUser(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionEstablished(state, action: PayloadAction<{ accessToken: string; user: AuthUser }>) {
      localStorage.setItem("servms_token", action.payload.accessToken);
      localStorage.setItem("servms_user", JSON.stringify(action.payload.user));
      state.user = action.payload.user;
    },
    sessionCleared(state) {
      localStorage.removeItem("servms_token");
      localStorage.removeItem("servms_user");
      state.user = null;
    },
  },
});

export const { sessionEstablished, sessionCleared } = authSlice.actions;
export default authSlice.reducer;
