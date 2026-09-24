import {
  Box,
  BoxStatus,
  CheckedOutBoxDetails,
  Customer,
  DailyMeal,
  GlobalSetting,
  Order,
  OrderMeal,
  RunningNoControl,
  StoreLocation,
  Timeslot,
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

export type StoreLocationDto = {
  id: string;
  name: string;
};

export type TimeslotDto = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  capacity: number;
};

export type GlobalSettingDto = {
  orderWhatsappNumber?: string;
  dailyCutOffTime?: string;
  timeslots?: TimeslotDto[];
  storeLocations?: StoreLocationDto[];
};

export type DailyMealDto = {
  id: string;
  date: string;
  dayOfWeek: string;
  dishesName?: string;
  dishesDescription?: string;
  dishesIngredients?: string;
  basicBoxPrice?: number;
  basicBoxInventory?: number;
  extraLargePrice?: number;
  extraLargeInventory?: number;
  extraProteinPrice?: number;
  extraProteinInventory?: number;
  extraVeggiePrice?: number;
  extraVeggieInventory?: number;
  extraSoupBoxPrice?: number;
  extraSoupBoxInventory?: number;
};

export type OrderMealDto = {
  addons?: string[];
};

export type OrderDto = {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  date: string;
  dayOfWeek: string;
  timeslotId: string;
  storeLocationId: string;
  meals?: OrderMealDto[];
  status: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
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

export const mapStoreLocation = (dto: StoreLocationDto): StoreLocation => ({
  id: dto.id,
  name: dto.name,
});

export const mapTimeslot = (dto: TimeslotDto): Timeslot => ({
  id: dto.id,
  label: dto.label,
  startTime: dto.startTime ?? "",
  endTime: dto.endTime ?? "",
  capacity: dto.capacity,
});

export const mapGlobalSetting = (dto: GlobalSettingDto): GlobalSetting => ({
  orderWhatsappNumber: dto.orderWhatsappNumber ?? "",
  dailyCutOffTime: dto.dailyCutOffTime ?? "",
  timeslots: (dto.timeslots ?? []).map(mapTimeslot),
  storeLocations: (dto.storeLocations ?? []).map(mapStoreLocation),
});

export const mapDailyMeal = (dto: DailyMealDto): DailyMeal => ({
  id: dto.id,
  date: dto.date,
  dayOfWeek: dto.dayOfWeek,
  dishesName: dto.dishesName ?? "",
  dishesDescription: dto.dishesDescription ?? "",
  dishesIngredients: dto.dishesIngredients ?? "",
  basicBoxPrice: dto.basicBoxPrice ?? 0,
  basicBoxInventory: dto.basicBoxInventory ?? 0,
  extraLargePrice: dto.extraLargePrice ?? 0,
  extraLargeInventory: dto.extraLargeInventory ?? 0,
  extraProteinPrice: dto.extraProteinPrice ?? 0,
  extraProteinInventory: dto.extraProteinInventory ?? 0,
  extraVeggiePrice: dto.extraVeggiePrice ?? 0,
  extraVeggieInventory: dto.extraVeggieInventory ?? 0,
  extraSoupBoxPrice: dto.extraSoupBoxPrice ?? 0,
  extraSoupBoxInventory: dto.extraSoupBoxInventory ?? 0,
});

export const mapOrderMeal = (dto: OrderMealDto): OrderMeal => ({
  addons: dto.addons ?? [],
});

export const mapOrder = (dto: OrderDto): Order => ({
  id: dto.id,
  customerId: dto.customerId,
  customerName: dto.customerName ?? null,
  customerPhone: dto.customerPhone ?? null,
  date: dto.date,
  dayOfWeek: dto.dayOfWeek,
  timeslotId: dto.timeslotId,
  storeLocationId: dto.storeLocationId,
  meals: (dto.meals ?? []).map(mapOrderMeal),
  status: dto.status,
  totalAmount: dto.totalAmount,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
});
