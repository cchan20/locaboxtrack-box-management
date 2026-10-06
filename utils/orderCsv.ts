import { DailyMeal, Order } from "@/types/app";
import { addonLabelFromMeal } from "@/utils/orderWeek";

export const ORDER_CSV_HEADERS = [
  "orderId",
  "customerId",
  "customerName",
  "customerPhone",
  "date",
  "dayOfWeek",
  "timeslot",
  "storeLocation",
  "status",
  "pickedBoxIds",
  "totalAmount",
  "mealCount",
  "meals",
  "footnote",
  "createdAt",
  "updatedAt",
] as const;

function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatMeals(order: Order, meal?: DailyMeal | null): string {
  return order.meals
    .map((orderMeal, index) => {
      const addons =
        orderMeal.addons.length === 0
          ? "Basic"
          : orderMeal.addons.map((addon) => addonLabelFromMeal(addon, meal)).join(", ");
      return `Meal ${index + 1}: ${addons}`;
    })
    .join("; ");
}

export type OrderCsvLabelResolvers = {
  resolveTimeslotLabel: (timeslotId: string) => string;
  resolveLocationLabel: (storeLocationId: string) => string;
  resolveDailyMeal?: (date: string) => DailyMeal | null | undefined;
};

/** Build a CSV string for the given orders (one row per order). */
export function buildOrdersCsv(
  orders: Order[],
  resolvers: OrderCsvLabelResolvers,
): string {
  const lines = [ORDER_CSV_HEADERS.join(",")];

  for (const order of orders) {
    const meal = resolvers.resolveDailyMeal?.(order.date);
    const row = [
      order.id,
      order.customerId,
      order.customerName ?? "",
      order.customerPhone ?? "",
      order.date,
      order.dayOfWeek,
      resolvers.resolveTimeslotLabel(order.timeslotId),
      resolvers.resolveLocationLabel(order.storeLocationId),
      order.status,
      (order.pickedBoxIds ?? []).join("; "),
      order.totalAmount.toFixed(2),
      order.meals.length,
      formatMeals(order, meal),
      order.footnote ?? "",
      order.createdAt,
      order.updatedAt,
    ].map(escapeCsvCell);

    lines.push(row.join(","));
  }

  return `${lines.join("\n")}\n`;
}
