import { Box, BoxStatus } from "@/types/app";

export const BOX_CSV_HEADERS = ["boxId", "status"] as const;

export type BoxCsvRow = {
  id: string;
  status: BoxStatus;
};

const VALID_STATUSES = new Set<BoxStatus>(["available", "checked-out", "unavailable"]);

function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
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

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function parseStatus(value: string, rowNumber: number): BoxStatus {
  const status = value.trim().toLowerCase() as BoxStatus;
  if (!VALID_STATUSES.has(status)) {
    throw new Error(
      `Row ${rowNumber}: status must be available, checked-out, or unavailable.`,
    );
  }
  return status;
}

/** Build a CSV string with box id and status (one row per box). */
export function buildBoxesCsv(boxes: Box[]): string {
  const lines = [BOX_CSV_HEADERS.join(",")];

  for (const box of boxes) {
    lines.push([box.id, box.status].map(escapeCsvCell).join(","));
  }

  return `${lines.join("\n")}\n`;
}

/** Parse a boxes CSV in the same format as export (`boxId,status`). */
export function parseBoxesCsv(content: string): BoxCsvRow[] {
  const rows = parseCsvRows(content);
  if (rows.length === 0) {
    throw new Error("CSV is empty.");
  }

  const header = rows[0].map(normalizeHeader);
  const boxIdIndex = header.findIndex((value) => value === "boxid" || value === "id");
  const statusIndex = header.findIndex((value) => value === "status");

  if (boxIdIndex < 0 || statusIndex < 0) {
    throw new Error('CSV must include "boxId" and "status" columns.');
  }

  const byId = new Map<string, BoxCsvRow>();

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 1;
    const id = (row[boxIdIndex] ?? "").trim();
    const statusRaw = row[statusIndex] ?? "";

    if (!id) {
      throw new Error(`Row ${rowNumber}: boxId is required.`);
    }

    byId.set(id, {
      id,
      status: parseStatus(statusRaw, rowNumber),
    });
  }

  if (byId.size === 0) {
    throw new Error("CSV has no box rows.");
  }

  return Array.from(byId.values());
}
