import { DailyMealInput } from "@/types/app";

export const DAILY_MEAL_CSV_HEADERS = [
  "date",
  "dishesName",
  "dishesDescription",
  "dishesIngredients",
  "basicBoxPrice",
  "basicBoxInventory",
  "extraLargePrice",
  "extraLargeInventory",
  "extraProteinPrice",
  "extraProteinInventory",
  "extraVeggiePrice",
  "extraVeggieInventory",
  "extraSoupBoxPrice",
  "extraSoupBoxInventory",
] as const;

const DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;

/** Normalize a CSV date (YYYYMMDD) to the API date format (YYYY-MM-DD). */
function normalizeCsvDate(value: string): string | null {
  const match = DATE_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(current);
    current = "";
  };

  const pushRow = () => {
    // Skip completely empty trailing rows.
    if (row.length === 1 && row[0].trim() === "") {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      pushCell();
      continue;
    }

    if (char === "\n") {
      pushCell();
      pushRow();
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }

  return rows;
}

function parseNumber(value: string, field: string, rowNumber: number, integer = false) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Row ${rowNumber}: ${field} must be zero or a positive number.`);
  }
  if (integer && !Number.isInteger(parsed)) {
    throw new Error(`Row ${rowNumber}: ${field} must be a whole number.`);
  }
  return parsed;
}

/**
 * Parse a daily-meals CSV template into API meal inputs.
 * Expects a header row matching DAILY_MEAL_CSV_HEADERS (order flexible by name).
 */
export function parseDailyMealsCsv(content: string): DailyMealInput[] {
  const rows = parseCsvRows(content);
  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const header = rows[0].map((cell) => cell.trim());
  const indexByHeader = new Map(header.map((name, index) => [name, index]));

  for (const required of DAILY_MEAL_CSV_HEADERS) {
    if (!indexByHeader.has(required)) {
      throw new Error(`CSV is missing required column: ${required}`);
    }
  }

  const cell = (row: string[], key: (typeof DAILY_MEAL_CSV_HEADERS)[number]) =>
    (row[indexByHeader.get(key)!] ?? "").trim();

  const meals: DailyMealInput[] = [];
  const seenDates = new Set<string>();

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 1;
    if (row.every((value) => !value.trim())) {
      continue;
    }

    const rawDate = cell(row, "date");
    const date = normalizeCsvDate(rawDate);
    if (!date) {
      throw new Error(`Row ${rowNumber}: date must be YYYYMMDD.`);
    }
    if (seenDates.has(date)) {
      throw new Error(`Row ${rowNumber}: duplicate date ${rawDate}.`);
    }
    seenDates.add(date);

    const dishesName = cell(row, "dishesName");
    if (!dishesName) {
      throw new Error(`Row ${rowNumber}: dishesName is required.`);
    }

    meals.push({
      date,
      dishesName,
      dishesDescription: cell(row, "dishesDescription"),
      dishesIngredients: cell(row, "dishesIngredients").replace(/;\s*/g, "\n"),
      basicBoxPrice: parseNumber(cell(row, "basicBoxPrice"), "basicBoxPrice", rowNumber),
      basicBoxInventory: parseNumber(
        cell(row, "basicBoxInventory"),
        "basicBoxInventory",
        rowNumber,
        true,
      ),
      extraLargePrice: parseNumber(cell(row, "extraLargePrice"), "extraLargePrice", rowNumber),
      extraLargeInventory: parseNumber(
        cell(row, "extraLargeInventory"),
        "extraLargeInventory",
        rowNumber,
        true,
      ),
      extraProteinPrice: parseNumber(
        cell(row, "extraProteinPrice"),
        "extraProteinPrice",
        rowNumber,
      ),
      extraProteinInventory: parseNumber(
        cell(row, "extraProteinInventory"),
        "extraProteinInventory",
        rowNumber,
        true,
      ),
      extraVeggiePrice: parseNumber(cell(row, "extraVeggiePrice"), "extraVeggiePrice", rowNumber),
      extraVeggieInventory: parseNumber(
        cell(row, "extraVeggieInventory"),
        "extraVeggieInventory",
        rowNumber,
        true,
      ),
      extraSoupBoxPrice: parseNumber(
        cell(row, "extraSoupBoxPrice"),
        "extraSoupBoxPrice",
        rowNumber,
      ),
      extraSoupBoxInventory: parseNumber(
        cell(row, "extraSoupBoxInventory"),
        "extraSoupBoxInventory",
        rowNumber,
        true,
      ),
    });
  }

  if (meals.length === 0) {
    throw new Error("CSV does not contain any meal rows.");
  }

  return meals;
}
