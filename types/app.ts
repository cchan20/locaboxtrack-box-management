export type BoxStatus = "available" | "checked-out" | "unavailable";

export type Box = {
  id: string;
  status: BoxStatus;
  customerId: string | null;
  customerName: string | null;
  dateOut: string | null;
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
  id: number;
  boxId: string;
  customerId: string;
  customerName: string | null;
  userId: number;
  type: TransactionType;
  date: number;
};

export type NotificationType = "success" | "error" | "warning";

export type Notification = {
  message: string;
  type: NotificationType;
};
