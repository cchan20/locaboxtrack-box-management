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
  mustResetPassword: boolean;
  creditCount: number;
  currentTaken: number;
  totalTaken: number;
  totalReturned: number;
  lateReturns: number;
  lateCancelCount: number;
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

export type StoreLocation = {
  id: string;
  name: string;
};

export type Timeslot = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  capacity: number;
};

export type GlobalSetting = {
  orderWhatsappNumber: string;
  dailyCutOffTime: string;
  maxMealsPerOrder: number;
  welcomeMessage: string;
  hasWelcomeImage: boolean;
  welcomeImageUpdatedAt: number;
  timeslots: Timeslot[];
  storeLocations: StoreLocation[];
};

export type DailyMeal = {
  id: string;
  date: string;
  dayOfWeek: string;
  dishesName: string;
  dishesDescription: string;
  dishesIngredients: string;
  basicBoxPrice: number;
  basicBoxInventory: number;
  extraLargePrice: number;
  extraLargeInventory: number;
  extraField1Name: string;
  extraField1Price: number;
  extraField1Inventory: number;
  extraField2Name: string;
  extraField2Price: number;
  extraField2Inventory: number;
  extraField3Name: string;
  extraField3Price: number;
  extraField3Inventory: number;
  extraField4Name: string;
  extraField4Price: number;
  extraField4Inventory: number;
  extraField5Name: string;
  extraField5Price: number;
  extraField5Inventory: number;
};

export type DailyMealInput = {
  date: string;
  dishesName: string;
  dishesDescription: string;
  dishesIngredients: string;
  basicBoxPrice: number;
  basicBoxInventory: number;
  extraLargePrice: number;
  extraLargeInventory: number;
  extraField1Name: string;
  extraField1Price: number;
  extraField1Inventory: number;
  extraField2Name: string;
  extraField2Price: number;
  extraField2Inventory: number;
  extraField3Name: string;
  extraField3Price: number;
  extraField3Inventory: number;
  extraField4Name: string;
  extraField4Price: number;
  extraField4Inventory: number;
  extraField5Name: string;
  extraField5Price: number;
  extraField5Inventory: number;
};

export type OrderMeal = {
  addons: string[];
};

export type Order = {
  id: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  walkInCustomerName: string | null;
  date: string;
  dayOfWeek: string;
  timeslotId: string;
  storeLocationId: string;
  footnote: string;
  meals: OrderMeal[];
  status: string;
  pickedBoxIds: string[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
};

export type UpsertOrderPayload = {
  timeslotId: string;
  storeLocationId: string;
  footnote?: string;
  walkInCustomerName?: string;
  meals: OrderMeal[];
};

export type StockLevel = {
  original: number;
  sold: number;
  remaining: number;
};

export type TimeslotAvailability = {
  timeslotId: string;
  label: string;
  original: number;
  sold: number;
  remaining: number;
};

export type DayAvailability = {
  date: string;
  dayOfWeek: string;
  basicBox: StockLevel;
  extraLarge: StockLevel;
  extraField1: StockLevel;
  extraField2: StockLevel;
  extraField3: StockLevel;
  extraField4: StockLevel;
  extraField5: StockLevel;
  timeslots: TimeslotAvailability[];
};

export type WeekDay =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday";

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
