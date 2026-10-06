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
  "extraField1Name",
  "extraField1Price",
  "extraField1Inventory",
  "extraField2Name",
  "extraField2Price",
  "extraField2Inventory",
  "extraField3Name",
  "extraField3Price",
  "extraField3Inventory",
  "extraField4Name",
  "extraField4Price",
  "extraField4Inventory",
  "extraField5Name",
  "extraField5Price",
  "extraField5Inventory",
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

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushCell();
    } else if (ch === "\n") {
      pushCell();
      pushRow();
    } else if (ch === "\r") {
      // ignore CR; LF handles row ends
    } else {
      current += ch;
    }
  }

  if (current.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }

  return rows;
}

function parseNumber(
  value: string,
  field: string,
  rowNumber: number,
  integer = false,
): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Row ${rowNumber}: ${field} must be zero or a positive number.`);
  }
  if (integer && !Number.isInteger(parsed)) {
    throw new Error(`Row ${rowNumber}: ${field} must be an integer.`);
  }
  return parsed;
}

export function parseDailyMealsCsv(content: string): DailyMealInput[] {
  const rows = parseCsvRows(content);
  if (rows.length === 0) {
    throw new Error("CSV is empty.");
  }

  const header = rows[0].map((cell) => cell.trim());
  const indexByHeader = new Map<string, number>();
  header.forEach((name, index) => {
    if (name) {
      indexByHeader.set(name, index);
    }
  });

  for (const required of DAILY_MEAL_CSV_HEADERS) {
    if (!indexByHeader.has(required)) {
      throw new Error(`CSV is missing required column: ${required}`);
    }
  }

  const cell = (row: string[], name: (typeof DAILY_MEAL_CSV_HEADERS)[number]) => {
    const index = indexByHeader.get(name);
    if (index == null) {
      return "";
    }
    return (row[index] ?? "").trim();
  };

  const meals: DailyMealInput[] = [];
  const seenDates = new Set<string>();

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 1;
    const rawDate = cell(row, "date");
    if (!rawDate) {
      continue;
    }
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
      extraField1Name: cell(row, "extraField1Name"),
      extraField1Price: parseNumber(
        cell(row, "extraField1Price"),
        "extraField1Price",
        rowNumber,
      ),
      extraField1Inventory: parseNumber(
        cell(row, "extraField1Inventory"),
        "extraField1Inventory",
        rowNumber,
        true,
      ),
      extraField2Name: cell(row, "extraField2Name"),
      extraField2Price: parseNumber(
        cell(row, "extraField2Price"),
        "extraField2Price",
        rowNumber,
      ),
      extraField2Inventory: parseNumber(
        cell(row, "extraField2Inventory"),
        "extraField2Inventory",
        rowNumber,
        true,
      ),
      extraField3Name: cell(row, "extraField3Name"),
      extraField3Price: parseNumber(
        cell(row, "extraField3Price"),
        "extraField3Price",
        rowNumber,
      ),
      extraField3Inventory: parseNumber(
        cell(row, "extraField3Inventory"),
        "extraField3Inventory",
        rowNumber,
        true,
      ),
      extraField4Name: cell(row, "extraField4Name"),
      extraField4Price: parseNumber(
        cell(row, "extraField4Price"),
        "extraField4Price",
        rowNumber,
      ),
      extraField4Inventory: parseNumber(
        cell(row, "extraField4Inventory"),
        "extraField4Inventory",
        rowNumber,
        true,
      ),
      extraField5Name: cell(row, "extraField5Name"),
      extraField5Price: parseNumber(
        cell(row, "extraField5Price"),
        "extraField5Price",
        rowNumber,
      ),
      extraField5Inventory: parseNumber(
        cell(row, "extraField5Inventory"),
        "extraField5Inventory",
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
