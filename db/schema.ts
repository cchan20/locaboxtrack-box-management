import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').unique().notNull(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const boxes = sqliteTable('boxes', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  customerId: text('customer_id'),
  customerName: text('customer_name'),
  dateOut: integer('date_out', { mode: 'timestamp' }),
});

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  externalId: text('external_id'),
  creditCount: integer('credit_count').notNull().default(1),
  currentTaken: integer('current_taken').notNull().default(0),
  totalTaken: integer('total_taken').notNull().default(0),
  totalReturned: integer('total_returned').notNull().default(0),
  lateReturns: integer('late_returns').notNull().default(0),
  riskStatus: text('risk_status').notNull().default('low'), // "low", "medium", "high"
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  boxId: text('box_id').notNull(),
  customerId: text('customer_id').notNull(),
  userId: integer('user_id').notNull(),
  type: text('type').notNull(), // "checkout" or "return"
  date: integer('date', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const running_no_control = sqliteTable('running_no_control', {
  id: text('id').primaryKey(),
  currentNumber: integer('current_number').notNull().default(0),
});
