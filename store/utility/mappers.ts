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
  lateCancelCount: number;
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
  welcomeMessage?: string;
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
  extraField1Name?: string;
  extraField1Price?: number;
  extraField1Inventory?: number;
  extraField2Name?: string;
  extraField2Price?: number;
  extraField2Inventory?: number;
  extraField3Name?: string;
  extraField3Price?: number;
  extraField3Inventory?: number;
  extraField4Name?: string;
  extraField4Price?: number;
  extraField4Inventory?: number;
  extraField5Name?: string;
  extraField5Price?: number;
  extraField5Inventory?: number;
};

export type OrderMealDto = {
  addons?: string[];
};

export type OrderDto = {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  walkInCustomerName?: string;
  date: string;
  dayOfWeek: string;
  timeslotId: string;
  storeLocationId: string;
  footnote?: string;
  meals?: OrderMealDto[];
  status: string;
  pickedBoxIds?: string[];
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
  lateCancelCount: dto.lateCancelCount ?? 0,
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
  welcomeMessage: dto.welcomeMessage ?? "",
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
  extraField1Name: dto.extraField1Name ?? "",
  extraField1Price: dto.extraField1Price ?? 0,
  extraField1Inventory: dto.extraField1Inventory ?? 0,
  extraField2Name: dto.extraField2Name ?? "",
  extraField2Price: dto.extraField2Price ?? 0,
  extraField2Inventory: dto.extraField2Inventory ?? 0,
  extraField3Name: dto.extraField3Name ?? "",
  extraField3Price: dto.extraField3Price ?? 0,
  extraField3Inventory: dto.extraField3Inventory ?? 0,
  extraField4Name: dto.extraField4Name ?? "",
  extraField4Price: dto.extraField4Price ?? 0,
  extraField4Inventory: dto.extraField4Inventory ?? 0,
  extraField5Name: dto.extraField5Name ?? "",
  extraField5Price: dto.extraField5Price ?? 0,
  extraField5Inventory: dto.extraField5Inventory ?? 0,
});

export const mapOrderMeal = (dto: OrderMealDto): OrderMeal => ({
  addons: dto.addons ?? [],
});

export const mapOrder = (dto: OrderDto): Order => ({
  id: dto.id,
  customerId: dto.customerId,
  customerName: dto.customerName ?? null,
  customerPhone: dto.customerPhone ?? null,
  walkInCustomerName: dto.walkInCustomerName ?? null,
  date: dto.date,
  dayOfWeek: dto.dayOfWeek,
  timeslotId: dto.timeslotId,
  storeLocationId: dto.storeLocationId,
  footnote: dto.footnote ?? "",
  meals: (dto.meals ?? []).map(mapOrderMeal),
  status: dto.status,
  pickedBoxIds: dto.pickedBoxIds ?? [],
  totalAmount: dto.totalAmount,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
});
