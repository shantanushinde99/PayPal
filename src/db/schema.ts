import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  name: text(),
  homeCurrency: text().notNull().default("USD"),
  isAdmin: boolean().notNull().default(false),
  createdAt: timestamp().notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid().primaryKey().defaultRandom(),
  clientId: uuid().notNull().references(() => users.id),
  freelancerEmail: text().notNull(),
  title: text().notNull(),
  description: text().notNull(),
  currency: text().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const milestones = pgTable("milestones", {
  id: uuid().primaryKey().defaultRandom(),
  jobId: uuid().notNull().references(() => jobs.id),
  position: integer().notNull(),
  title: text().notNull(),
  amountMinor: integer().notNull(),
  proofType: text().notNull().default("website"),
  state: text().notNull().default("draft"),
  direct: boolean().notNull().default(false), // funded with the freelancer as payee (no payout step)
  orderId: text(),
  authorizationId: text(),
  captureId: text(),
  payoutBatchId: text(),
  failReason: text(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const checklistItems = pgTable("checklist_items", {
  id: uuid().primaryKey().defaultRandom(),
  milestoneId: uuid().notNull().references(() => milestones.id),
  position: integer().notNull(),
  requirement: text().notNull(),
});

export const submissions = pgTable("submissions", {
  id: uuid().primaryKey().defaultRandom(),
  milestoneId: uuid().notNull().references(() => milestones.id),
  url: text(), // website proof
  beforePhoto: text(), // photo proof: image data URLs (demo scale)
  afterPhoto: text(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const verdictItems = pgTable("verdict_items", {
  id: uuid().primaryKey().defaultRandom(),
  submissionId: uuid().notNull().references(() => submissions.id),
  checklistItemId: uuid().notNull().references(() => checklistItems.id),
  status: text().notNull(),
  reason: text().notNull(),
});

// Audit log + live agent steps. image = base64 JPEG (demo scale).
export const events = pgTable("events", {
  id: uuid().primaryKey().defaultRandom(),
  milestoneId: uuid().notNull().references(() => milestones.id),
  kind: text().notNull(), // state | agent | payment | error
  message: text().notNull(),
  image: text(),
  createdAt: timestamp().notNull().defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
