import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer, date, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordExpires: timestamp("reset_password_expires"),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  schema: jsonb("schema").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  provider: text("provider").default("razorpay"),
  status: text("status").notNull().default("free"),
  razorpayCustomerId: text("razorpay_customer_id"),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id),
  day: date("day").notNull(),
  count: integer("count").notNull().default(0),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  notes: text("notes"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  adminReply: text("admin_reply"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const automationLogs = pgTable("automation_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobName: text("job_name").notNull(),
  status: text("status").notNull().default("running"),
  message: text("message"),
  triggeredBy: text("triggered_by").default("system"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const formSubmissions = pgTable("form_submissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  pageId: text("page_id"),
  formType: text("form_type").notNull().default("contact"),
  data: jsonb("data").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userQueries = pgTable("user_queries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  adminReply: text("admin_reply"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey(),
  contactEmail: text("contact_email").notNull().default("support@pixel-prompt.app"),
  contactPhone: text("contact_phone").notNull().default("+1 (555) 000-0000"),
  contactAddress: text("contact_address").notNull().default("PixelPrompt HQ, San Francisco, CA"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, role: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true, userId: true, status: true, createdAt: true, updatedAt: true });
export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, userId: true, status: true, adminReply: true, createdAt: true, updatedAt: true });
export const insertUserQuerySchema = createInsertSchema(userQueries).omit({ id: true, status: true, adminReply: true, createdAt: true, updatedAt: true });
export const insertSiteSettingsSchema = createInsertSchema(siteSettings);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type AiUsage = typeof aiUsage.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type AutomationLog = typeof automationLogs.$inferSelect;
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type UserQuery = typeof userQueries.$inferSelect;
export type InsertUserQuery = z.infer<typeof insertUserQuerySchema>;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type InsertSiteSettings = z.infer<typeof insertSiteSettingsSchema>;

// --- Component Block Types ---

export const componentSchema = z.object({
  id: z.string(),
  type: z.enum([
    "hero", "section", "heading", "text", "button", "image", "divider", "spacer", "features",
    "navbar", "footer", "product-card", "pricing-table", "contact-form", "testimonials",
    "gallery", "video", "faq", "stats", "team", "social-links", "banner", "countdown", "newsletter",
    "logo-cloud", "cta",
    // New components
    "blog-post", "blog-list", "cart", "checkout-form", "map", "booking-form", "login-form",
  ]),
  props: z.record(z.any()).optional(),
  children: z.array(z.any()).optional(),
  style: z.object({
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
    padding: z.string().optional(),
    margin: z.string().optional(),
    borderRadius: z.string().optional(),
    animation: z.enum(["none", "fade-in", "slide-up", "slide-down", "slide-left", "slide-right", "zoom-in", "zoom-out", "flip", "bounce"]).optional(),
    animationDuration: z.string().optional(),
    animationDelay: z.string().optional(),
    customCss: z.string().optional(),
  }).optional(),
});

export type ComponentBlock = z.infer<typeof componentSchema>;

// --- Multi-Page Project Schema ---

export const pageSeoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  ogImage: z.string().optional(),
});

export const pageSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  blocks: z.array(componentSchema),
  seo: pageSeoSchema.optional(),
});

export const projectSettingsSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  fontFamily: z.string().optional(),
  headingFont: z.string().optional(),
  customCSS: z.string().optional(),
});

export const projectDataSchema = z.object({
  pages: z.array(pageSchema),
  settings: projectSettingsSchema.optional(),
});

export type PageData = z.infer<typeof pageSchema>;
export type PageSeo = z.infer<typeof pageSeoSchema>;
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;
export type ProjectData = z.infer<typeof projectDataSchema>;

// Helper to migrate old flat schema to new multi-page format
export function migrateProjectSchema(schema: any): ProjectData {
  if (!schema) return { pages: [{ id: "home", name: "Home", path: "/", blocks: [], seo: {} }], settings: {} };

  // Already in new format
  if (schema.pages && Array.isArray(schema.pages)) {
    return schema as ProjectData;
  }

  // Old flat array format — migrate to single "Home" page
  if (Array.isArray(schema)) {
    return {
      pages: [{ id: "home", name: "Home", path: "/", blocks: schema as ComponentBlock[], seo: {} }],
      settings: {},
    };
  }

  return { pages: [{ id: "home", name: "Home", path: "/", blocks: [], seo: {} }], settings: {} };
}
