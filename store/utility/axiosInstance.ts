import { API_BASE_URL } from "@/constants/config";
import axios, { type InternalAxiosRequestConfig } from "axios";

const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

type TimedRequestConfig = InternalAxiosRequestConfig & {
  metadata?: { startTime: number };
};

function requestLabel(config: InternalAxiosRequestConfig | undefined): string {
  const method = (config?.method ?? "?").toUpperCase();
  const base = config?.baseURL ?? "";
  const url = config?.url ?? "";
  const fullUrl = url.startsWith("http") ? url : `${base}${url}`;
  return `${method} ${fullUrl}`;
}

axiosInstance.interceptors.request.use((config: TimedRequestConfig) => {
  // Lazy import avoids circular dependency with the store.
  const { store } = require("@/store") as typeof import("@/store");
  const token = store.getState().auth.token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.metadata = { startTime: Date.now() };
  console.log(`[API] → ${requestLabel(config)}`);

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => {
    const config = response.config as TimedRequestConfig;
    const durationMs = config.metadata?.startTime
      ? Date.now() - config.metadata.startTime
      : undefined;

    console.log(
      `[API] ← ${response.status} ${requestLabel(config)}` +
        (durationMs != null ? ` (${durationMs}ms)` : ""),
    );

    return response;
  },
  (error) => {
    const config = error?.config as TimedRequestConfig | undefined;
    const durationMs = config?.metadata?.startTime
      ? Date.now() - config.metadata.startTime
      : undefined;
    const status = error?.response?.status ?? "ERR";
    const message = error?.message ?? "unknown error";

    console.warn(
      `[API] ✕ ${status} ${requestLabel(config)}` +
        (durationMs != null ? ` (${durationMs}ms)` : "") +
        ` — ${message}`,
    );

    if (error?.response?.status === 401) {
      const { store } = require("@/store") as typeof import("@/store");
      const { logout } = require("@/store/slices/authSlice") as typeof import("@/store/slices/authSlice");
      store.dispatch(logout());
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
