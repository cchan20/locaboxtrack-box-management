import { ROOT_PASSWORD, ROOT_USERNAME } from "@/constants/auth";
import { findUserByCredentials, initializeDatabase } from "@/database/appDatabase";
import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

export type LoginUserType = "root" | "user";

export type LoginUser = {
  id: number | null;
  username: string;
  name: string;
  status: string;
  type: LoginUserType;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  loginUser: LoginUser | null;
  loginError: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUser, setLoginUser] = useState<LoginUser | null>(null);
  const [loginError, setLoginError] = useState(false);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      loginUser,
      loginError,
      login: async (username: string, password: string) => {
        const normalizedUsername = username.trim();
        const normalizedPassword = password.trim();

        if (!normalizedUsername || !normalizedPassword) {
          setIsAuthenticated(false);
          setLoginUser(null);
          setLoginError(true);
          return false;
        }

        const isRoot = normalizedUsername.toLowerCase() === ROOT_USERNAME.toLowerCase();

        if (isRoot) {
          const ok = normalizedPassword === ROOT_PASSWORD;
          setIsAuthenticated(ok);
          setLoginUser(
            ok
              ? {
                  id: null,
                  username: ROOT_USERNAME,
                  name: "Root",
                  status: "active",
                  type: "root",
                }
              : null,
          );
          setLoginError(!ok);
          return ok;
        }

        await initializeDatabase();
        const user = await findUserByCredentials(normalizedUsername, normalizedPassword);
        const ok = Boolean(user);

        setIsAuthenticated(ok);
        setLoginUser(
          user
            ? {
                id: user.id,
                username: user.username,
                name: user.name,
                status: user.status,
                type: "user",
              }
            : null,
        );
        setLoginError(!ok);
        return ok;
      },
      logout: () => {
        setIsAuthenticated(false);
        setLoginUser(null);
        setLoginError(false);
      },
    }),
    [isAuthenticated, loginError, loginUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
