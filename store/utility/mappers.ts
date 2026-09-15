import {
  Box,
  BoxStatus,
  CheckedOutBoxDetails,
  Customer,
  RunningNoControl,
  TransactionHistoryItem,
  User,
  UserRole,
} from "@/types/app";

export type BoxDto = {
  id: string;
  status: BoxStatus;
  customerId?: string;
  customerName?: string;
  dateOut?: string;
};

export type CheckedOutBoxDetailDto = BoxDto & {
  customerPhone?: string;
};

export type CustomerDto = {
  id: string;
  name: string;
  phone: string;
  email: string;
  externalId?: string;
  creditCount: number;
  currentTaken: number;
  totalTaken: number;
  totalReturned: number;
  lateReturns: number;
  riskStatus: Customer["riskStatus"];
};

export type TransactionDto = {
  id: string;
  boxId: string;
  customerId: string;
  customerName?: string;
  userId: string;
  type: TransactionHistoryItem["type"];
  date: string;
};

export type UserDto = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PrefixDto = {
  id: string;
  currentNumber: number;
};

export const mapBox = (dto: BoxDto): Box => ({
  id: dto.id,
  status: dto.status,
  customerId: dto.customerId ?? null,
  customerName: dto.customerName ?? null,
  dateOut: dto.dateOut ?? null,
});

export const mapCheckedOutDetail = (dto: CheckedOutBoxDetailDto): CheckedOutBoxDetails => ({
  ...mapBox(dto),
  customerPhone: dto.customerPhone ?? null,
});

export const mapCustomer = (dto: CustomerDto): Customer => ({
  id: dto.id,
  name: dto.name,
  phone: dto.phone,
  email: dto.email,
  externalId: dto.externalId ?? null,
  creditCount: dto.creditCount,
  currentTaken: dto.currentTaken,
  totalTaken: dto.totalTaken,
  totalReturned: dto.totalReturned,
  lateReturns: dto.lateReturns,
  riskStatus: dto.riskStatus,
});

export const mapTransaction = (dto: TransactionDto): TransactionHistoryItem => ({
  id: dto.id,
  boxId: dto.boxId,
  customerId: dto.customerId,
  customerName: dto.customerName ?? null,
  userId: dto.userId,
  type: dto.type,
  date: dto.date,
});

export const mapUser = (dto: UserDto): User => ({
  id: dto.id,
  username: dto.username,
  name: dto.name,
  role: dto.role,
  status: dto.status,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
});

export const mapPrefix = (dto: PrefixDto): RunningNoControl => ({
  id: dto.id,
  currentNumber: dto.currentNumber,
});
