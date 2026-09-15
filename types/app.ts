export type BoxStatus = "available" | "checked-out" | "unavailable";

export type Box = {
  id: string;
  status: BoxStatus;
  customerId: string | null;
  customerName: string | null;
  dateOut: string | null;
};

export type CheckedOutBoxDetails = Box & {
  customerPhone: string | null;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  externalId: string | null;
  creditCount: number;
  currentTaken: number;
  totalTaken: number;
  totalReturned: number;
  lateReturns: number;
  riskStatus: "low" | "medium" | "high";
};

export type TransactionType = "checkout" | "return";

export type TransactionHistoryItem = {
  id: string;
  boxId: string;
  customerId: string;
  customerName: string | null;
  userId: string;
  type: TransactionType;
  date: string;
};

export type UserRole = "ADMIN" | "STAFF";

export type User = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RunningNoControl = {
  id: string;
  currentNumber: number;
};

export type DashboardStats = {
  totalBoxes: number;
  availableCount: number;
  safeCount: number;
  unavailableCount: number;
  checkedOutCount: number;
  warningCount: number;
  overdueCount: number;
};

export type NotificationType = "success" | "error" | "warning";

export type Notification = {
  message: string;
  type: NotificationType;
};

export type LoginResponse = {
  token: string;
  user: {
    id: string;
    username: string;
    name: string;
    role: UserRole;
  };
};

export type AuthUser = LoginResponse["user"] & {
  status: string;
};
