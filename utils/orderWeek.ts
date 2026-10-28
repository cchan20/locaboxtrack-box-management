import { DailyMeal, DayAvailability, WeekDay } from "@/types/app";

export const WEEK_DAYS: WeekDay[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

/** Fallback when global settings have not loaded or omit a value. */
export const DEFAULT_MAX_MEALS_PER_ORDER = 2;
export const MAX_MEALS_PER_ORDER_CAP = 10;
export const MAX_ORDER_FOOTNOTE_LENGTH = 100;

export function effectiveMaxMealsPerOrder(value?: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return DEFAULT_MAX_MEALS_PER_ORDER;
  }
  return Math.min(Math.floor(value), MAX_MEALS_PER_ORDER_CAP);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Anchor used for order-week menus. After Sunday 12:00 noon local time,
 * the next calendar week is treated as the current order week.
 */
export function orderWeekAnchor(ref: Date = new Date()): Date {
  if (ref.getDay() === 0 && ref.getHours() * 60 + ref.getMinutes() >= 12 * 60) {
    const next = new Date(ref);
    next.setDate(ref.getDate() + 1);
    return next;
  }
  return ref;
}

export function getCurrentWeekRange(ref: Date = new Date()): {
  from: string;
  to: string;
} {
  const anchor = orderWeekAnchor(ref);
  const day = anchor.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(anchor);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(anchor.getDate() + mondayOffset);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return { from: formatDate(monday), to: formatDate(friday) };
}

/** Shift `ref` by `weeks` calendar weeks (positive = future). */
export function shiftWeek(ref: Date, weeks: number): Date {
  const next = new Date(ref);
  next.setDate(ref.getDate() + weeks * 7);
  return next;
}

/**
 * True when `candidate`'s order week is at or after the earliest allowed
 * order week (current week after Sunday-noon rollover).
 */
export function isOrderWeekAllowed(
  candidate: Date,
  now: Date = new Date(),
): boolean {
  return getCurrentWeekRange(candidate).from >= getCurrentWeekRange(now).from;
}

export function datesByDay(ref: Date = new Date()): Record<WeekDay, string> {
  const { from } = getCurrentWeekRange(ref);
  const [y, m, d] = from.split("-").map(Number);
  const monday = new Date(y, m - 1, d);
  const map = {} as Record<WeekDay, string>;
  WEEK_DAYS.forEach((day, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    map[day] = formatDate(date);
  });
  return map;
}

const DAY_FROM_SHORT: Record<string, WeekDay> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Monday: "Monday",
  Tuesday: "Tuesday",
  Wednesday: "Wednesday",
  Thursday: "Thursday",
  Friday: "Friday",
};

function dayFromShortOrDate(dayOfWeek: string, isoDate?: string): WeekDay | undefined {
  if (DAY_FROM_SHORT[dayOfWeek]) {
    return DAY_FROM_SHORT[dayOfWeek];
  }
  if (!isoDate) {
    return undefined;
  }
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) {
    return undefined;
  }
  const short = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
  return DAY_FROM_SHORT[short];
}

export function mealsByDay(meals: DailyMeal[]): Partial<Record<WeekDay, DailyMeal>> {
  const map: Partial<Record<WeekDay, DailyMeal>> = {};
  for (const meal of meals) {
    const day = dayFromShortOrDate(meal.dayOfWeek, meal.date);
    if (day) {
      map[day] = meal;
    }
  }
  return map;
}

export function availabilityByDay(
  rows: DayAvailability[],
): Partial<Record<WeekDay, DayAvailability>> {
  const map: Partial<Record<WeekDay, DayAvailability>> = {};
  for (const row of rows) {
    const day = dayFromShortOrDate(row.dayOfWeek, row.date);
    if (day) {
      map[day] = row;
    }
  }
  return map;
}

export function firstOrderableDay(
  weekDates: Record<WeekDay, string>,
  ref: Date = new Date(),
): WeekDay {
  const today = formatDate(ref);
  return WEEK_DAYS.find((day) => weekDates[day] >= today) ?? "Monday";
}

export type AddonOption = {
  id: string;
  label: string;
  price: number;
};

type ExtraFieldNameKey =
  | "extraField1Name"
  | "extraField2Name"
  | "extraField3Name"
  | "extraField4Name"
  | "extraField5Name"
  | "optionField1Name"
  | "optionField2Name";

type ExtraFieldPriceKey =
  | "extraField1Price"
  | "extraField2Price"
  | "extraField3Price"
  | "extraField4Price"
  | "extraField5Price"
  | "optionField1Price"
  | "optionField2Price";

type ExtraFieldDef = {
  id: string;
  nameKey: ExtraFieldNameKey;
  priceKey: ExtraFieldPriceKey;
  fallback: string;
};

const EXTRA_FIELDS: ExtraFieldDef[] = [
  { id: "ef1", nameKey: "extraField1Name", priceKey: "extraField1Price", fallback: "Extra Field 1" },
  { id: "ef2", nameKey: "extraField2Name", priceKey: "extraField2Price", fallback: "Extra Field 2" },
  { id: "ef3", nameKey: "extraField3Name", priceKey: "extraField3Price", fallback: "Extra Field 3" },
  { id: "ef4", nameKey: "extraField4Name", priceKey: "extraField4Price", fallback: "Extra Field 4" },
  { id: "ef5", nameKey: "extraField5Name", priceKey: "extraField5Price", fallback: "Extra Field 5" },
  { id: "of1", nameKey: "optionField1Name", priceKey: "optionField1Price", fallback: "Option Field 1" },
  { id: "of2", nameKey: "optionField2Name", priceKey: "optionField2Price", fallback: "Option Field 2" },
];

/** Option fields are mutually exclusive on a single meal. */
export const OPTION_FIELD_PAIR: Record<string, string> = {
  of1: "of2",
  of2: "of1",
};

export function toggleMealAddon(
  addons: string[],
  addonId: string,
  currentlyOn: boolean,
): string[] {
  if (currentlyOn) {
    return addons.filter((x) => x !== addonId);
  }
  const conflict = OPTION_FIELD_PAIR[addonId];
  const next = conflict ? addons.filter((x) => x !== conflict) : [...addons];
  return [...next, addonId];
}

export function isOptionFieldBlocked(
  addons: string[],
  addonId: string,
  currentlyOn: boolean,
): boolean {
  if (currentlyOn) {
    return false;
  }
  const conflict = OPTION_FIELD_PAIR[addonId];
  return conflict ? addons.includes(conflict) : false;
}

export function addonLabelFromMeal(
  addonId: string,
  meal?: Pick<DailyMeal, ExtraFieldNameKey> | null,
): string {
  if (addonId === "xl") {
    return "BigBox Upgrade";
  }
  const field = EXTRA_FIELDS.find((item) => item.id === addonId);
  if (!field) {
    return addonId;
  }
  const name = (meal?.[field.nameKey] ?? "").trim();
  return name || field.fallback;
}

export function addonsFromDailyMeal(meal: DailyMeal): AddonOption[] {
  const addons: AddonOption[] = [];
  if (meal.extraLargePrice > 0) {
    addons.push({ id: "xl", label: "BigBox Upgrade", price: meal.extraLargePrice });
  }
  for (const field of EXTRA_FIELDS) {
    const price = meal[field.priceKey];
    if (price > 0) {
      addons.push({
        id: field.id,
        label: addonLabelFromMeal(field.id, meal),
        price,
      });
    }
  }
  return addons;
}

type AddonStockKey = Extract<
  keyof DayAvailability,
  | "extraLarge"
  | "extraField1"
  | "extraField2"
  | "extraField3"
  | "extraField4"
  | "extraField5"
  | "optionField1"
  | "optionField2"
>;

const ADDON_AVAIL_KEY: Record<string, AddonStockKey> = {
  xl: "extraLarge",
  ef1: "extraField1",
  ef2: "extraField2",
  ef3: "extraField3",
  ef4: "extraField4",
  ef5: "extraField5",
  of1: "optionField1",
  of2: "optionField2",
};

export function countAddonInMeals(
  meals: { addons: string[] }[] | undefined,
  addonId: string,
): number {
  if (!meals?.length) {
    return 0;
  }
  return meals.reduce(
    (n, meal) => n + (meal.addons.includes(addonId) ? 1 : 0),
    0,
  );
}

/** Effective remaining for an addon, adjusting for draft vs already-sold selection. */
export function getAddonRemaining(
  dayAvail: DayAvailability | undefined,
  addonId: string,
  draftMeals: { addons: string[] }[] | undefined,
  savedMeals?: { addons: string[] }[] | undefined,
): number {
  const key = ADDON_AVAIL_KEY[addonId];
  if (!key) {
    return 0;
  }
  const server = dayAvail?.[key]?.remaining ?? 0;
  const savedCount = countAddonInMeals(savedMeals, addonId);
  const draftCount = countAddonInMeals(draftMeals, addonId);
  return server + savedCount - draftCount;
}

export function mealCost(
  basicBoxPrice: number,
  addons: string[],
  addonOptions: AddonOption[],
): number {
  return (
    basicBoxPrice +
    addons.reduce(
      (sum, id) => sum + (addonOptions.find((a) => a.id === id)?.price ?? 0),
      0,
    )
  );
}

export function orderCost(
  basicBoxPrice: number,
  meals: { addons: string[] }[],
  addonOptions: AddonOption[],
): number {
  return meals.reduce(
    (sum, meal) => sum + mealCost(basicBoxPrice, meal.addons, addonOptions),
    0,
  );
}

export function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}
