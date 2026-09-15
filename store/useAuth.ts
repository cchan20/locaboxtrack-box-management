import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearLoginError,
  login as loginThunk,
  loginFailure,
  logout as logoutAction,
} from "@/store/slices/authSlice";
import { getErrorMessage } from "@/utils/apiError";
import { useCallback, useMemo } from "react";

export function useAuth() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const loginUser = useAppSelector((state) => state.auth.user);
  const loginError = useAppSelector((state) => state.auth.loginError);

  const login = useCallback(
    async (username: string, password: string) => {
      const normalizedUsername = username.trim();
      const normalizedPassword = password.trim();

      if (!normalizedUsername || !normalizedPassword) {
        dispatch(loginFailure());
        return false;
      }

      try {
        await dispatch(
          loginThunk({
            username: normalizedUsername,
            password: normalizedPassword,
          }),
        ).unwrap();
        return true;
      } catch (error) {
        console.warn("Login failed:", getErrorMessage(error));
        dispatch(loginFailure());
        return false;
      }
    },
    [dispatch],
  );

  const logout = useCallback(() => {
    dispatch(logoutAction());
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch(clearLoginError());
  }, [dispatch]);

  return useMemo(
    () => ({
      isAuthenticated: Boolean(token && loginUser),
      loginUser,
      loginError,
      isAdmin: loginUser?.role === "ADMIN",
      login,
      logout,
      clearError,
    }),
    [token, loginUser, loginError, login, logout, clearError],
  );
}
