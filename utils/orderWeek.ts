import { DailyMeal, DayAvailability, WeekDay } from "@/types/app";

export const WEEK_DAYS: WeekDay[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

export const MAX_MEALS_PER_ORDER = 2;

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getCurrentWeekRange(ref: Date = new Date()): {
  from: string;
  to: string;
} {
  const day = ref.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(ref);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(ref.getDate() + mondayOffset);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return { from: formatDate(monday), to: formatDate(friday) };
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

export function addonsFromDailyMeal(meal: DailyMeal): AddonOption[] {
  const addons: AddonOption[] = [];
  if (meal.extraLargePrice > 0) {
    addons.push({ id: "xl", label: "Extra Large", price: meal.extraLargePrice });
  }
  if (meal.extraProteinPrice > 0) {
    addons.push({ id: "pro", label: "Extra Protein", price: meal.extraProteinPrice });
  }
  if (meal.extraVeggiePrice > 0) {
    addons.push({ id: "veg", label: "Extra Veggie", price: meal.extraVeggiePrice });
  }
  if (meal.extraSoupBoxPrice > 0) {
    addons.push({ id: "soup", label: "Add Soup", price: meal.extraSoupBoxPrice });
  }
  return addons;
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
