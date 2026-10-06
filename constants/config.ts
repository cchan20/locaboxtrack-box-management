import { Platform } from "react-native";

/**
 * Backend base URL for the loca-box API.
 * - iOS simulator: localhost works
 * - Android emulator: 10.0.2.2 maps to the host machine
 * - Physical device: set EXPO_PUBLIC_API_BASE_URL to your machine LAN IP
 */
const DEFAULT_HOST =
  Platform.OS === "android" ? "http://10.0.2.2:8081" : "http://localhost:8081";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || DEFAULT_HOST;

export const TRANSACTION_HISTORY_LIMIT = 100;

export const CUSTOMER_PAGE_SIZE = 20;

export const BOX_PAGE_SIZE = 20;

/** Sentinel customer id for walk-in orders (matches backend WalkInCustomerId). */
export const WALK_IN_CUSTOMER_ID = "WALK-IN";
