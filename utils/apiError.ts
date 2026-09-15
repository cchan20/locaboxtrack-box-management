import axios from "axios";

type ApiErrorBody = {
  msg?: string;
  message?: string;
};

export function getErrorMessage(
  error: unknown,
  fallback = "Request failed. Please try again.",
): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | string | undefined;

    if (typeof data === "string" && data.trim()) {
      return data;
    }

    if (data && typeof data === "object") {
      if (typeof data.msg === "string" && data.msg.trim()) {
        return data.msg;
      }
      if (typeof data.message === "string" && data.message.trim()) {
        return data.message;
      }
    }

    if (error.message) {
      return error.message;
    }
  }

  if (typeof error === "object" && error !== null) {
    const maybe = error as { data?: ApiErrorBody | string; message?: string };

    if (typeof maybe.data === "string" && maybe.data.trim()) {
      return maybe.data;
    }

    if (maybe.data && typeof maybe.data === "object") {
      if (typeof maybe.data.msg === "string" && maybe.data.msg.trim()) {
        return maybe.data.msg;
      }
      if (typeof maybe.data.message === "string" && maybe.data.message.trim()) {
        return maybe.data.message;
      }
    }

    if (typeof maybe.message === "string" && maybe.message.trim()) {
      return maybe.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
