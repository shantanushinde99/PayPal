import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  name: text(),
  homeCurrency: text().notNull().default("USD"),
  isAdmin: boolean().notNull().default(false),
  roles: text().array().notNull().default([]), // client | freelancer
  displayName: text(),
  company: text(),
  headline: text(),
  skills: text().array().notNull().default([]),
  bio: text(),
  portfolioUrl: text(),
  onboardedAt: timestamp({ withTimezone: true }),
  isDemo: boolean().notNull().default(false),
  demoGroup: uuid(),
  payoutEmail: text(), // where payments go if not the login email (demo users → sandbox account)
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS(); // Supabase: no public API access; the app connects as the owner

export const jobs = pgTable("jobs", {
  id: uuid().primaryKey().defaultRandom(),
  clientId: uuid().notNull().references(() => users.id),
  freelancerEmail: text().notNull(), // payout address; for unclaimed invites also who may accept
  freelancerId: uuid().references(() => users.id), // set when hired from the directory or on accept
  status: text().notNull().default("invited"), // invited | accepted | declined
  declineNote: text(),
  acceptedAt: timestamp({ withTimezone: true }),
  title: text().notNull(),
  description: text().notNull(),
  currency: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS(); // Supabase: no public API access; the app connects as the owner

export const milestones = pgTable("milestones", {
  id: uuid().primaryKey().defaultRandom(),
  jobId: uuid().notNull().references(() => jobs.id),
  position: integer().notNull(),
  title: text().notNull(),
  amountMinor: integer().notNull(),
  proofType: text().notNull().default("website"),
  state: text().notNull().default("draft"),
  direct: boolean().notNull().default(false), // funded with the freelancer as payee (no payout step)
  referenceImage: text(), // optional client design reference (image data URL)
  orderId: text(),
  authorizationId: text(),
  captureId: text(),
  payoutBatchId: text(),
  failReason: text(),
  releaseAt: timestamp({ withTimezone: true }), // end of the review window after an AI pass
  capturedMinor: integer(), // what was actually paid; less than amountMinor after a split decision
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS(); // Supabase: no public API access; the app connects as the owner

export const checklistItems = pgTable("checklist_items", {
  id: uuid().primaryKey().defaultRandom(),
  milestoneId: uuid().notNull().references(() => milestones.id),
  position: integer().notNull(),
  requirement: text().notNull(),
  lintNote: text(), // checklist checker hint, null = fine
}).enableRLS(); // Supabase: no public API access; the app connects as the owner

export const submissions = pgTable("submissions", {
  id: uuid().primaryKey().defaultRandom(),
  milestoneId: uuid().notNull().references(() => milestones.id),
  url: text(), // website proof
  beforePhoto: text(), // photo proof: image data URLs (demo scale)
  afterPhoto: text(),
  report: jsonb(), // SiteReport for website proofs
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS(); // Supabase: no public API access; the app connects as the owner

export const verdictItems = pgTable("verdict_items", {
  id: uuid().primaryKey().defaultRandom(),
  submissionId: uuid().notNull().references(() => submissions.id),
  checklistItemId: uuid().notNull().references(() => checklistItems.id),
  status: text().notNull(),
  reason: text().notNull(),
  evidence: text(),
  pageUrl: text(),
}).enableRLS(); // Supabase: no public API access; the app connects as the owner

// One per milestone: a client disputing an AI pass, or a freelancer disputing an AI fail.
export const disputes = pgTable("disputes", {
  id: uuid().primaryKey().defaultRandom(),
  milestoneId: uuid().notNull().unique().references(() => milestones.id),
  openedBy: text().notNull(), // client | freelancer
  clientStatement: text(),
  freelancerStatement: text(),
  status: text().notNull().default("open"), // open | judged | escalated | resolved
  judgeShare: integer(), // freelancer's share 0-100 proposed by the AI Judge
  judgeReasoning: text(),
  decideAt: timestamp({ withTimezone: true }), // judged decision settles automatically after this
  clientAccepted: boolean().notNull().default(false),
  freelancerAccepted: boolean().notNull().default(false),
  rejectedBy: text(),
  finalShare: integer(),
  adminNote: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp({ withTimezone: true }),
}).enableRLS(); // Supabase: no public API access; the app connects as the owner

// Every money movement, in structured form (the activity log has the same events as text).
export const payments = pgTable("payments", {
  id: uuid().primaryKey().defaultRandom(),
  milestoneId: uuid().notNull().references(() => milestones.id),
  kind: text().notNull(), // hold | paid (direct capture) | captured (to platform) | payout | void
  amountMinor: integer().notNull(),
  currency: text().notNull(),
  paypalId: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS(); // Supabase: no public API access; the app connects as the owner

// Audit log + live agent steps. image = base64 JPEG (demo scale).
export const events = pgTable("events", {
  id: uuid().primaryKey().defaultRandom(),
  milestoneId: uuid().notNull().references(() => milestones.id),
  kind: text().notNull(), // state | agent | payment | error
  message: text().notNull(),
  image: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS(); // Supabase: no public API access; the app connects as the owner

export type Job = typeof jobs.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type User = typeof users.$inferSelect;
export type Dispute = typeof disputes.$inferSelect;
