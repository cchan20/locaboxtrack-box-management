import { Box, BoxStatus, Customer, TransactionHistoryItem, TransactionType } from "@/types/app";
import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

type BoxRow = {
  id: string;
  status: BoxStatus;
  customer_id: string | null;
  customer_name: string | null;
  date_out: string | null;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  external_id: string | null;
  credit_count: number;
  current_taken: number;
  total_taken: number;
  total_returned: number;
  late_returns: number;
  risk_status: "low" | "medium" | "high";
};

export type UserRow = {
  id: number;
  username: string;
  password: string;
  name: string;
  status: string;
  created_at: number;
  updated_at: number;
};

export type TransactionRow = {
  id: number;
  box_id: string;
  customer_id: string;
  user_id: number;
  type: TransactionType;
  date: number;
};

type TransactionHistoryRow = TransactionRow & {
  customer_name: string | null;
};

export type RunningNoControlRow = {
  id: string;
  current_number: number;
};

type SqliteIntegrityCheckRow = {
  quick_check: string;
};

type SqliteMasterTableRow = {
  name: string;
};

const REQUIRED_DATABASE_TABLES = [
  "boxes",
  "customers",
  "transactions",
  "users",
  "running_no_control",
] as const;

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("lms.db");
  }

  return dbPromise;
}

async function validateImportedDatabase(database: SQLite.SQLiteDatabase) {
  const integrityResult = await database.getFirstAsync<SqliteIntegrityCheckRow>("PRAGMA quick_check;");

  if (!integrityResult || integrityResult.quick_check !== "ok") {
    throw new Error("The selected file is not a valid SQLite database.");
  }

  const tableRows = await database.getAllAsync<SqliteMasterTableRow>(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%';`,
  );
  const tableNames = new Set(tableRows.map((row) => row.name));
  const missingTables = REQUIRED_DATABASE_TABLES.filter((tableName) => !tableNames.has(tableName));

  if (missingTables.length > 0) {
    throw new Error(`The selected database is missing required tables: ${missingTables.join(", ")}.`);
  }
}

function mapBoxRow(row: BoxRow): Box {
  return {
    id: row.id,
    status: row.status,
    customerId: row.customer_id,
    customerName: row.customer_name,
    dateOut: row.date_out,
  };
}

function mapCustomerRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    externalId: row.external_id,
    creditCount: row.credit_count,
    currentTaken: row.current_taken,
    totalTaken: row.total_taken,
    totalReturned: row.total_returned,
    lateReturns: row.late_returns,
    riskStatus: row.risk_status,
  };
}

export async function initializeDatabase() {
  // Drizzle migrations are responsible for schema setup and seed data.
  await getDb();
}

export async function exportDatabaseSnapshot(): Promise<Uint8Array> {
  const db = await getDb();
  return db.serializeAsync();
}

export async function importDatabaseSnapshot(serializedData: Uint8Array) {
  const db = await getDb();
  const importedDb = await SQLite.deserializeDatabaseAsync(serializedData, {
    useNewConnection: true,
  });

  try {
    await validateImportedDatabase(importedDb);
    await SQLite.backupDatabaseAsync({
      sourceDatabase: importedDb,
      destDatabase: db,
    });
  } finally {
    await importedDb.closeAsync();
  }
}

export async function clearAllDatabaseData() {
  const db = await getDb();

  await db.runAsync("DELETE FROM transactions;");
  await db.runAsync("DELETE FROM boxes;");
  await db.runAsync("DELETE FROM customers;");
  await db.runAsync("DELETE FROM users;");
  await db.runAsync("DELETE FROM running_no_control;");
}

export async function fetchBoxes(): Promise<Box[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BoxRow>("SELECT * FROM boxes ORDER BY id ASC;");
  return rows.map(mapBoxRow);
}

export async function fetchCustomers(): Promise<Customer[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CustomerRow>("SELECT * FROM customers ORDER BY name ASC;");
  return rows.map(mapCustomerRow);
}

export async function findCustomerByName(name: string): Promise<Customer | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CustomerRow>(
    "SELECT * FROM customers WHERE lower(name) = lower(?) LIMIT 1;",
    name,
  );
  return row ? mapCustomerRow(row) : null;
}

export async function findCustomerByExternalId(externalId: string): Promise<Customer | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CustomerRow>(
    "SELECT * FROM customers WHERE external_id = ? LIMIT 1;",
    externalId,
  );
  return row ? mapCustomerRow(row) : null;
}

export async function insertCustomer(customer: Customer) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO customers (id, name, phone, email, external_id, total_taken, total_returned, late_returns, risk_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    customer.id,
    customer.name,
    customer.phone,
    customer.email,
    customer.externalId,
    customer.totalTaken,
    customer.totalReturned,
    customer.lateReturns,
    customer.riskStatus,
  );
}

export async function updateCustomerDetails(input: {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  externalId: string | null;
}) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE customers
     SET name = ?,
         phone = ?,
         email = ?,
         external_id = ?
     WHERE id = ?;`,
    input.name,
    input.phone,
    input.email,
    input.externalId,
    input.customerId,
  );
}

export async function updateCustomerRiskStatus(
  customerId: string,
  riskStatus: "low" | "medium" | "high",
) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE customers
     SET risk_status = ?
     WHERE id = ?;`,
    riskStatus,
    customerId,
  );
}

export async function updateCustomerCreditCount(customerId: string, creditCount: number) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE customers
     SET credit_count = ?
     WHERE id = ?;`,
    creditCount,
    customerId,
  );
}

export async function deleteCustomer(customerId: string) {
  const db = await getDb();
  await db.runAsync("DELETE FROM customers WHERE id = ?;", customerId);
}

export async function insertBox(box: Box) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO boxes (id, status, customer_id, customer_name, date_out)
     VALUES (?, ?, ?, ?, ?);`,
    box.id,
    box.status,
    box.customerId,
    box.customerName,
    box.dateOut,
  );
}

export async function updateBoxCheckout(
  boxId: string,
  customerId: string | null,
  customerName: string,
  checkoutDate?: Date,
) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE boxes
     SET status = 'checked-out', customer_id = ?, customer_name = ?, date_out = ?
     WHERE id = ?;`,
    customerId,
    customerName,
    (checkoutDate ?? new Date()).toISOString(),
    boxId,
  );
}

export async function updateBoxCheckin(boxId: string) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE boxes
     SET status = 'available', customer_id = NULL, customer_name = NULL, date_out = NULL
     WHERE id = ?;`,
    boxId,
  );
}

export async function updateBoxAvailability(boxId: string, status: Extract<BoxStatus, "available" | "unavailable" | "checked-out">) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE boxes
     SET status = ?
     WHERE id = ?;`,
    status,
    boxId,
  );
}

export async function insertTransaction(input: {
  boxId: string;
  customerId: string;
  userId: number;
  type: TransactionType;
  date?: number;
}) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO transactions (box_id, customer_id, user_id, type, date)
     VALUES (?, ?, ?, ?, ?);`,
    input.boxId,
    input.customerId,
    input.userId,
    input.type,
    input.date ?? Date.now(),
  );
}

function mapTransactionHistoryRow(row: TransactionHistoryRow): TransactionHistoryItem {
  return {
    id: row.id,
    boxId: row.box_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    userId: row.user_id,
    type: row.type,
    date: row.date,
  };
}

export async function fetchTransactionsByBoxId(boxId: string): Promise<TransactionHistoryItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TransactionHistoryRow>(
    `SELECT t.*, c.name AS customer_name
     FROM transactions t
     LEFT JOIN customers c ON c.id = t.customer_id
     WHERE t.box_id = ?
     ORDER BY t.date DESC;`,
    boxId,
  );

  return rows.map(mapTransactionHistoryRow);
}

export async function fetchTransactionsByCustomerId(customerId: string): Promise<TransactionHistoryItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TransactionHistoryRow>(
    `SELECT t.*, c.name AS customer_name
     FROM transactions t
     LEFT JOIN customers c ON c.id = t.customer_id
     WHERE t.customer_id = ?
     ORDER BY t.date DESC;`,
    customerId,
  );

  return rows.map(mapTransactionHistoryRow);
}

export async function fetchTransactionsSince(sinceTimestamp: number): Promise<TransactionHistoryItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TransactionHistoryRow>(
    `SELECT t.*, c.name AS customer_name
     FROM transactions t
     LEFT JOIN customers c ON c.id = t.customer_id
     WHERE t.date >= ?
     ORDER BY t.date ASC;`,
    sinceTimestamp,
  );

  return rows.map(mapTransactionHistoryRow);
}

export async function incrementCustomerTaken(customerId: string) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE customers
     SET total_taken = total_taken + 1,
         current_taken = current_taken + 1
     WHERE id = ?;`,
    customerId,
  );
}

export async function incrementCustomerReturned(customerId: string, isLate: boolean) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE customers
     SET total_returned = total_returned + 1,
         current_taken = CASE WHEN current_taken > 0 THEN current_taken - 1 ELSE 0 END,
         late_returns = late_returns + ?
     WHERE id = ?;`,
    isLate ? 1 : 0,
    customerId,
  );
}

export async function fetchUsers(): Promise<UserRow[]> {
  const db = await getDb();
  return db.getAllAsync<UserRow>("SELECT * FROM users ORDER BY id DESC;");
}

export async function fetchUserById(id: number): Promise<UserRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<UserRow>("SELECT * FROM users WHERE id = ? LIMIT 1;", id);
  return row ?? null;
}

export async function findUserByCredentials(
  username: string,
  password: string,
): Promise<UserRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<UserRow>(
    `SELECT *
     FROM users
     WHERE lower(username) = lower(?)
       AND password = ?
       AND lower(status) = 'active'
     LIMIT 1;`,
    username,
    password,
  );

  return row ?? null;
}

export async function createUser(input: {
  username: string;
  password: string;
  name: string;
  status: string;
}) {
  const db = await getDb();
  const now = Date.now();
  console.log("Creating user with input:", input);
  
  await db.runAsync(
    `INSERT INTO users (username, password, name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?);`,
    input.username,
    input.password,
    input.name,
    input.status,
    now,
    now,
  );
}

export async function updateUser(
  id: number,
  input: {
    username: string;
    name: string;
    status: string;
    password?: string;
  },
) {
  const db = await getDb();
  const now = Date.now();

  if (input.password) {
    await db.runAsync(
      `UPDATE users
       SET username = ?, password = ?, name = ?, status = ?, updated_at = ?
       WHERE id = ?;`,
      input.username,
      input.password,
      input.name,
      input.status,
      now,
      id,
    );
    return;
  }

  await db.runAsync(
    `UPDATE users
     SET username = ?, name = ?, status = ?, updated_at = ?
     WHERE id = ?;`,
    input.username,
    input.name,
    input.status,
    now,
    id,
  );
}

export async function deleteUser(id: number) {
  const db = await getDb();
  await db.runAsync("DELETE FROM users WHERE id = ?;", id);
}

export async function fetchPrefixes(): Promise<RunningNoControlRow[]> {
  const db = await getDb();
  return db.getAllAsync<RunningNoControlRow>("SELECT * FROM running_no_control ORDER BY id ASC;");
}

export async function fetchPrefixById(prefix: string): Promise<RunningNoControlRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RunningNoControlRow>(
    "SELECT * FROM running_no_control WHERE id = ? LIMIT 1;",
    prefix,
  );
  return row ?? null;
}

export async function createBoxesFromPrefix(prefix: string, count: number) {
  const db = await getDb();
  const prefixRow = await fetchPrefixById(prefix);

  if (!prefixRow) {
    throw new Error("Prefix not found.");
  }

  const safeCount = Math.max(0, Math.floor(count));

  if (!safeCount) {
    return { createdCount: 0, lastNumber: prefixRow.current_number };
  }

  let lastNumber = prefixRow.current_number;

  for (let step = 1; step <= safeCount; step += 1) {
    const sequence = prefixRow.current_number + step;
    const boxId = `${prefixRow.id}-${sequence}`;

    await db.runAsync(
      `INSERT INTO boxes (id, status, customer_id, customer_name, date_out)
       VALUES (?, 'available', NULL, NULL, NULL);`,
      boxId,
    );

    lastNumber = sequence;
  }

  await db.runAsync(
    `UPDATE running_no_control
     SET current_number = ?
     WHERE id = ?;`,
    lastNumber,
    prefixRow.id,
  );

  return { createdCount: safeCount, lastNumber };
}

export async function addPrefix(prefix: string) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO running_no_control (id, current_number)
     VALUES (?, 0);`,
    prefix,
  );
}

export async function deletePrefix(prefix: string) {
  const db = await getDb();
  await db.runAsync("DELETE FROM running_no_control WHERE id = ?;", prefix);
}
