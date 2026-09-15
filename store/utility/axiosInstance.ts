import { API_BASE_URL } from "@/constants/config";
import axios from "axios";

const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

axiosInstance.interceptors.request.use((config) => {
  // Lazy import avoids circular dependency with the store.
  const { store } = require("@/store") as typeof import("@/store");
  const token = store.getState().auth.token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const { store } = require("@/store") as typeof import("@/store");
      const { logout } = require("@/store/slices/authSlice") as typeof import("@/store/slices/authSlice");
      store.dispatch(logout());
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
