import { AuthUser, LoginResponse, UserRole } from "@/types/app";
import axiosInstance from "@/store/utility/axiosInstance";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  loginError: boolean;
  loading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  token: null,
  user: null,
  loginError: false,
  loading: false,
  error: null,
};

type LoginSuccessPayload = {
  token: string;
  user: {
    id: string;
    username: string;
    name: string;
    role: UserRole;
  };
};

export const login = createAsyncThunk(
  "login",
  async (payload: { username: string; password: string }) => {
    try {
      const url = "auth/login";
      const response = await axiosInstance.post<LoginResponse>(url, payload);
      return { data: response.data };
    } catch (error) {
      throw error;
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginSuccess(state, action: PayloadAction<LoginSuccessPayload>) {
      state.token = action.payload.token;
      state.user = {
        ...action.payload.user,
        status: "active",
      };
      state.loginError = false;
      state.error = null;
    },
    loginFailure(state) {
      state.token = null;
      state.user = null;
      state.loginError = true;
    },
    clearLoginError(state) {
      state.loginError = false;
      state.error = null;
    },
    logout(state) {
      state.token = null;
      state.user = null;
      state.loginError = false;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(login.pending, (state) => {
      state.loading = true;
      state.loginError = false;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.loading = false;
      state.token = action.payload.data.token;
      state.user = {
        ...action.payload.data.user,
        status: "active",
      };
      state.loginError = false;
      state.error = null;
    });
    builder.addCase(login.rejected, (state) => {
      state.loading = false;
      state.token = null;
      state.user = null;
      state.loginError = true;
    });
  },
});

export const { loginSuccess, loginFailure, clearLoginError, logout } = authSlice.actions;
export default authSlice.reducer;
