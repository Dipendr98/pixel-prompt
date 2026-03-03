import { eq, and, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  users, projects, subscriptions, aiUsage, submissions, supportTickets, automationLogs, userQueries, siteSettings,
  type User, type InsertUser, type Project, type InsertProject,
  type Subscription, type AiUsage, type Submission, type InsertSubmission,
  type SupportTicket, type InsertSupportTicket, type AutomationLog,
  type UserQuery, type InsertUserQuery, type SiteSettings, type InsertSiteSettings
} from "@shared/schema";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserResetToken(userId: string, token: string | null, expires: Date | null): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  updateUserRole(userId: string, role: string): Promise<void>;

  getProjects(userId: string): Promise<Project[]>;
  getProject(id: string, userId: string): Promise<Project | undefined>;
  getProjectById(id: string): Promise<Project | undefined>;
  createProject(userId: string, data: InsertProject): Promise<Project>;
  updateProject(id: string, userId: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string, userId: string): Promise<boolean>;

  getSubscription(userId: string): Promise<Subscription | undefined>;
  upsertSubscription(userId: string, data: Partial<Subscription>): Promise<Subscription>;

  getAiUsage(userId: string, day: string): Promise<number>;
  incrementAiUsage(userId: string, day: string): Promise<void>;

  getSubmissions(userId: string): Promise<(Submission & { projectName?: string })[]>;
  getAllSubmissions(): Promise<(Submission & { projectName?: string; userEmail?: string })[]>;
  createSubmission(userId: string, data: InsertSubmission): Promise<Submission>;
  updateSubmissionStatus(id: string, status: string): Promise<void>;

  getSupportTickets(userId: string): Promise<(SupportTicket & { userEmail?: string })[]>;
  getAllSupportTickets(): Promise<(SupportTicket & { userEmail?: string })[]>;
  createSupportTicket(userId: string, data: InsertSupportTicket): Promise<SupportTicket>;
  updateSupportTicket(id: string, data: Partial<SupportTicket>): Promise<void>;

  getAllUsers(): Promise<Omit<User, "password">[]>;
  getAllProjects(): Promise<(Project & { userEmail?: string })[]>;
  getAdminStats(): Promise<{ totalUsers: number; totalProjects: number; activeSubscriptions: number; openTickets: number; totalSubmissions: number }>;
  cancelSubscription(userId: string): Promise<void>;

  updateUserRole(userId: string, role: string): Promise<void>;
  deleteUserAdmin(userId: string): Promise<void>;
  deleteProjectAdmin(projectId: string): Promise<void>;
  getAllSubscriptions(): Promise<(Subscription & { userEmail?: string })[]>;
  getRecentActivity(limit?: number): Promise<any[]>;

  createAutomationLog(jobName: string, triggeredBy: string): Promise<AutomationLog>;
  updateAutomationLog(id: string, status: string, message: string): Promise<void>;
  getAutomationLogs(limit?: number): Promise<AutomationLog[]>;
  resetAiUsage(): Promise<number>;
  expireSubscriptions(): Promise<number>;
  cleanupPendingPayments(): Promise<number>;

  createUserQuery(data: InsertUserQuery): Promise<UserQuery>;
  getAllUserQueries(): Promise<UserQuery[]>;
  updateUserQueryReply(id: string, reply: string): Promise<void>;

  getSiteSettings(): Promise<SiteSettings>;
  updateSiteSettings(data: Partial<InsertSiteSettings>): Promise<SiteSettings>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetPasswordToken, token));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserResetToken(userId: string, token: string | null, expires: Date | null): Promise<void> {
    await db.update(users).set({ resetPasswordToken: token, resetPasswordExpires: expires }).where(eq(users.id, userId));
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, userId));
  }

  async getProjects(userId: string): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(projects.createdAt);
  }

  async getProject(id: string, userId: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
    return project;
  }

  async getProjectById(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(userId: string, data: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values({ ...data, userId }).returning();
    return project;
  }

  async updateProject(id: string, userId: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();
    return project;
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    await db.delete(submissions).where(eq(submissions.projectId, id));
    const result = await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).returning();
    return result.length > 0;
  }

  async getSubscription(userId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return sub;
  }

  async upsertSubscription(userId: string, data: Partial<Subscription>): Promise<Subscription> {
    const existing = await this.getSubscription(userId);
    if (existing) {
      const [updated] = await db
        .update(subscriptions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(subscriptions.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(subscriptions)
      .values({ userId, status: "free", ...data })
      .returning();
    return created;
  }

  async getAiUsage(userId: string, day: string): Promise<number> {
    const [usage] = await db
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)));
    return usage?.count || 0;
  }

  async incrementAiUsage(userId: string, day: string): Promise<void> {
    const existing = await db
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)));
    if (existing.length > 0) {
      await db
        .update(aiUsage)
        .set({ count: sql`${aiUsage.count} + 1` })
        .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)));
    } else {
      await db.insert(aiUsage).values({ userId, day, count: 1 });
    }
  }

  async getSubmissions(userId: string): Promise<(Submission & { projectName?: string })[]> {
    const subs = await db.select().from(submissions).where(eq(submissions.userId, userId)).orderBy(submissions.createdAt);
    const result = [];
    for (const sub of subs) {
      const project = await this.getProjectById(sub.projectId);
      result.push({ ...sub, projectName: project?.name });
    }
    return result;
  }

  async getAllSubmissions(): Promise<(Submission & { projectName?: string; userEmail?: string })[]> {
    const subs = await db.select().from(submissions).orderBy(submissions.createdAt);
    const result = [];
    for (const sub of subs) {
      const project = await this.getProjectById(sub.projectId);
      const user = await this.getUser(sub.userId);
      result.push({ ...sub, projectName: project?.name, userEmail: user?.email });
    }
    return result;
  }

  async createSubmission(userId: string, data: InsertSubmission): Promise<Submission> {
    const [sub] = await db.insert(submissions).values({ ...data, userId }).returning();
    return sub;
  }

  async updateSubmissionStatus(id: string, status: string): Promise<void> {
    await db.update(submissions).set({ status, updatedAt: new Date() }).where(eq(submissions.id, id));
  }

  async getSupportTickets(userId: string): Promise<(SupportTicket & { userEmail?: string })[]> {
    const tickets = await db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(supportTickets.createdAt);
    return tickets;
  }

  async getAllSupportTickets(): Promise<(SupportTicket & { userEmail?: string })[]> {
    const tickets = await db.select().from(supportTickets).orderBy(supportTickets.createdAt);
    const result = [];
    for (const ticket of tickets) {
      const user = await this.getUser(ticket.userId);
      result.push({ ...ticket, userEmail: user?.email });
    }
    return result;
  }

  async createSupportTicket(userId: string, data: InsertSupportTicket): Promise<SupportTicket> {
    const [ticket] = await db.insert(supportTickets).values({ ...data, userId }).returning();
    return ticket;
  }

  async updateSupportTicket(id: string, data: Partial<SupportTicket>): Promise<void> {
    await db.update(supportTickets).set({ ...data, updatedAt: new Date() }).where(eq(supportTickets.id, id));
  }

  async getAllUsers(): Promise<Omit<User, "password">[]> {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      resetPasswordToken: users.resetPasswordToken,
      resetPasswordExpires: users.resetPasswordExpires,
    }).from(users);
    return allUsers;
  }

  async getAllProjects(): Promise<(Project & { userEmail?: string })[]> {
    const allProjects = await db.select().from(projects).orderBy(projects.createdAt);
    const result = [];
    for (const project of allProjects) {
      const user = await this.getUser(project.userId);
      result.push({ ...project, userEmail: user?.email });
    }
    return result;
  }

  async getAdminStats(): Promise<{ totalUsers: number; totalProjects: number; activeSubscriptions: number; openTickets: number; totalSubmissions: number }> {
    const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [projectCount] = await db.select({ count: sql<number>`count(*)::int` }).from(projects);
    const [subCount] = await db.select({ count: sql<number>`count(*)::int` }).from(subscriptions).where(eq(subscriptions.status, "active"));
    const [ticketCount] = await db.select({ count: sql<number>`count(*)::int` }).from(supportTickets).where(eq(supportTickets.status, "open"));
    const [submissionCount] = await db.select({ count: sql<number>`count(*)::int` }).from(submissions);
    return {
      totalUsers: userCount.count,
      totalProjects: projectCount.count,
      activeSubscriptions: subCount.count,
      openTickets: ticketCount.count,
      totalSubmissions: submissionCount.count,
    };
  }

  async cancelSubscription(userId: string): Promise<void> {
    await db.update(subscriptions).set({ status: "cancelled", updatedAt: new Date() }).where(eq(subscriptions.userId, userId));
  }


  async deleteUserAdmin(userId: string): Promise<void> {
    await db.delete(aiUsage).where(eq(aiUsage.userId, userId));
    await db.delete(supportTickets).where(eq(supportTickets.userId, userId));
    const userProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId));
    for (const p of userProjects) {
      await db.delete(submissions).where(eq(submissions.projectId, p.id));
    }
    await db.delete(projects).where(eq(projects.userId, userId));
    await db.delete(submissions).where(eq(submissions.userId, userId));
    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }

  async deleteProjectAdmin(projectId: string): Promise<void> {
    await db.delete(submissions).where(eq(submissions.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
  }

  async getAllSubscriptions(): Promise<(Subscription & { userEmail?: string })[]> {
    const subs = await db.select().from(subscriptions).orderBy(desc(subscriptions.updatedAt));
    const result = [];
    for (const sub of subs) {
      const user = await this.getUser(sub.userId);
      result.push({ ...sub, userEmail: user?.email });
    }
    return result;
  }

  async getRecentActivity(limit = 20): Promise<any[]> {
    const activities: any[] = [];
    const recentProjects = await db.select().from(projects).orderBy(desc(projects.createdAt)).limit(5);
    for (const p of recentProjects) {
      const u = await this.getUser(p.userId);
      activities.push({ type: "project_created", description: `${u?.email || "User"} created project "${p.name}"`, timestamp: p.createdAt });
    }
    const recentTickets = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(5);
    for (const t of recentTickets) {
      const u = await this.getUser(t.userId);
      activities.push({ type: "ticket_created", description: `${u?.email || "User"} opened ticket: ${t.subject}`, timestamp: t.createdAt });
    }
    const recentSubs = await db.select().from(submissions).orderBy(desc(submissions.createdAt)).limit(5);
    for (const s of recentSubs) {
      const u = await this.getUser(s.userId);
      activities.push({ type: "submission_created", description: `${u?.email || "User"} submitted a project for review`, timestamp: s.createdAt });
    }
    const recentAutomation = await db.select().from(automationLogs).orderBy(desc(automationLogs.startedAt)).limit(5);
    for (const a of recentAutomation) {
      activities.push({ type: "automation_run", description: `Job "${a.jobName}" ${a.status}`, timestamp: a.startedAt });
    }
    activities.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    return activities.slice(0, limit);
  }

  async createAutomationLog(jobName: string, triggeredBy: string): Promise<AutomationLog> {
    const [log] = await db.insert(automationLogs).values({ jobName, triggeredBy, status: "running" }).returning();
    return log;
  }

  async updateAutomationLog(id: string, status: string, message: string): Promise<void> {
    await db.update(automationLogs).set({ status, message, completedAt: new Date() }).where(eq(automationLogs.id, id));
  }

  async getAutomationLogs(limit = 50): Promise<AutomationLog[]> {
    return db.select().from(automationLogs).orderBy(desc(automationLogs.startedAt)).limit(limit);
  }

  async resetAiUsage(): Promise<number> {
    const result = await db.delete(aiUsage).where(lt(aiUsage.day, new Date().toISOString().split("T")[0])).returning();
    return result.length;
  }

  async expireSubscriptions(): Promise<number> {
    const result = await db
      .update(subscriptions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(eq(subscriptions.status, "active"), lt(subscriptions.currentPeriodEnd!, new Date())))
      .returning();
    return result.length;
  }

  async cleanupPendingPayments(): Promise<number> {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const result = await db
      .update(subscriptions)
      .set({ status: "failed", updatedAt: new Date() })
      .where(and(eq(subscriptions.status, "pending"), lt(subscriptions.createdAt!, thirtyMinAgo)))
      .returning();
    return result.length;
  }

  async createUserQuery(data: InsertUserQuery): Promise<UserQuery> {
    const [query] = await db.insert(userQueries).values(data).returning();
    return query;
  }

  async getAllUserQueries(): Promise<UserQuery[]> {
    return db.select().from(userQueries).orderBy(desc(userQueries.createdAt));
  }

  async updateUserQueryReply(id: string, reply: string): Promise<void> {
    await db.update(userQueries).set({ adminReply: reply, status: "answered", updatedAt: new Date() }).where(eq(userQueries.id, id));
  }

  async getSiteSettings(): Promise<SiteSettings> {
    const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
    if (!settings) {
      const [newSettings] = await db.insert(siteSettings).values({ id: 1 }).returning();
      return newSettings;
    }
    return settings;
  }

  async updateSiteSettings(data: Partial<InsertSiteSettings>): Promise<SiteSettings> {
    const [settings] = await db.update(siteSettings).set({ ...data, updatedAt: new Date() }).where(eq(siteSettings.id, 1)).returning();
    if (!settings) {
      const [newSettings] = await db.insert(siteSettings).values({ id: 1, ...data }).returning();
      return newSettings;
    }
    return settings;
  }
}

export class InMemoryStorage implements IStorage {
  private users = new Map<string, User>();
  private projects = new Map<string, Project>();
  private subscriptions = new Map<string, Subscription>();
  private aiUsageMap = new Map<string, number>();
  private submissionsMap = new Map<string, Submission>();
  private supportTicketsMap = new Map<string, SupportTicket>();
  private automationLogsMap = new Map<string, AutomationLog>();
  private userQueriesMap = new Map<string, UserQuery>();
  private siteSettingsMap = new Map<number, SiteSettings>();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.resetPasswordToken === token);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: randomUUID(),
      role: "user",
      resetPasswordToken: null,
      resetPasswordExpires: null,
      ...insertUser
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUserResetToken(userId: string, token: string | null, expires: Date | null): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.resetPasswordToken = token;
      user.resetPasswordExpires = expires;
    }
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.password = hashedPassword;
    }
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.role = role;
    }
  }


  async getProjects(userId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(p => p.userId === userId);
  }

  async getProject(id: string, userId: string): Promise<Project | undefined> {
    const p = this.projects.get(id);
    return p?.userId === userId ? p : undefined;
  }

  async getProjectById(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(userId: string, data: InsertProject): Promise<Project> {
    const project: Project = {
      id: randomUUID(),
      userId,
      name: data.name,
      schema: data.schema ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.set(project.id, project);
    return project;
  }

  async updateProject(id: string, userId: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project || project.userId !== userId) return undefined;
    const updated = { ...project, ...data, updatedAt: new Date() };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    const project = this.projects.get(id);
    if (!project || project.userId !== userId) return false;
    Array.from(this.submissionsMap.entries()).forEach(([sid, sub]) => {
      if (sub.projectId === id) this.submissionsMap.delete(sid);
    });
    this.projects.delete(id);
    return true;
  }

  async getSubscription(userId: string): Promise<Subscription | undefined> {
    return this.subscriptions.get(userId);
  }

  async upsertSubscription(userId: string, data: Partial<Subscription>): Promise<Subscription> {
    const existing = this.subscriptions.get(userId);
    if (existing) {
      const updated = { ...existing, ...data, updatedAt: new Date() };
      this.subscriptions.set(userId, updated);
      return updated;
    }
    const created: Subscription = {
      userId,
      provider: "razorpay",
      status: "free",
      razorpayCustomerId: null,
      razorpaySubscriptionId: null,
      currentPeriodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    this.subscriptions.set(userId, created);
    return created;
  }

  async getAiUsage(userId: string, day: string): Promise<number> {
    return this.aiUsageMap.get(`${userId}:${day}`) ?? 0;
  }

  async incrementAiUsage(userId: string, day: string): Promise<void> {
    const key = `${userId}:${day}`;
    this.aiUsageMap.set(key, (this.aiUsageMap.get(key) ?? 0) + 1);
  }

  async getSubmissions(userId: string): Promise<(Submission & { projectName?: string })[]> {
    const subs = [...this.submissionsMap.values()].filter(s => s.userId === userId);
    return subs.map(s => ({ ...s, projectName: this.projects.get(s.projectId)?.name }));
  }

  async getAllSubmissions(): Promise<(Submission & { projectName?: string; userEmail?: string })[]> {
    return [...this.submissionsMap.values()].map(s => ({
      ...s,
      projectName: this.projects.get(s.projectId)?.name,
      userEmail: this.users.get(s.userId)?.email,
    }));
  }

  async createSubmission(userId: string, data: InsertSubmission): Promise<Submission> {
    const sub: Submission = {
      id: randomUUID(),
      userId,
      projectId: data.projectId,
      notes: data.notes ?? null,
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.submissionsMap.set(sub.id, sub);
    return sub;
  }

  async updateSubmissionStatus(id: string, status: string): Promise<void> {
    const sub = this.submissionsMap.get(id);
    if (sub) this.submissionsMap.set(id, { ...sub, status, updatedAt: new Date() });
  }

  async getSupportTickets(userId: string): Promise<(SupportTicket & { userEmail?: string })[]> {
    return [...this.supportTicketsMap.values()].filter(t => t.userId === userId);
  }

  async getAllSupportTickets(): Promise<(SupportTicket & { userEmail?: string })[]> {
    return [...this.supportTicketsMap.values()].map(t => ({
      ...t,
      userEmail: this.users.get(t.userId)?.email,
    }));
  }

  async createSupportTicket(userId: string, data: InsertSupportTicket): Promise<SupportTicket> {
    const ticket: SupportTicket = {
      id: randomUUID(),
      userId,
      subject: data.subject,
      message: data.message,
      status: "open",
      adminReply: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.supportTicketsMap.set(ticket.id, ticket);
    return ticket;
  }

  async updateSupportTicket(id: string, data: Partial<SupportTicket>): Promise<void> {
    const ticket = this.supportTicketsMap.get(id);
    if (ticket) this.supportTicketsMap.set(id, { ...ticket, ...data, updatedAt: new Date() });
  }

  async getAllUsers(): Promise<Omit<User, "password">[]> {
    return [...this.users.values()].map(({ password: _, ...u }) => u);
  }

  async getAllProjects(): Promise<(Project & { userEmail?: string })[]> {
    return [...this.projects.values()].map(p => ({
      ...p,
      userEmail: this.users.get(p.userId)?.email,
    }));
  }

  async getAdminStats(): Promise<{ totalUsers: number; totalProjects: number; activeSubscriptions: number; openTickets: number; totalSubmissions: number }> {
    return {
      totalUsers: this.users.size,
      totalProjects: this.projects.size,
      activeSubscriptions: [...this.subscriptions.values()].filter(s => s.status === "active").length,
      openTickets: [...this.supportTicketsMap.values()].filter(t => t.status === "open").length,
      totalSubmissions: this.submissionsMap.size,
    };
  }

  async cancelSubscription(userId: string): Promise<void> {
    const sub = this.subscriptions.get(userId);
    if (sub) this.subscriptions.set(userId, { ...sub, status: "cancelled", updatedAt: new Date() });
  }


  async deleteUserAdmin(userId: string): Promise<void> {
    for (const key of [...this.aiUsageMap.keys()]) {
      if (key.startsWith(userId + ":")) this.aiUsageMap.delete(key);
    }
    for (const [id, t] of this.supportTicketsMap) {
      if (t.userId === userId) this.supportTicketsMap.delete(id);
    }
    for (const [id, p] of this.projects) {
      if (p.userId === userId) {
        for (const [sid, s] of this.submissionsMap) {
          if (s.projectId === id) this.submissionsMap.delete(sid);
        }
        this.projects.delete(id);
      }
    }
    for (const [id, s] of this.submissionsMap) {
      if (s.userId === userId) this.submissionsMap.delete(id);
    }
    this.subscriptions.delete(userId);
    this.users.delete(userId);
  }

  async deleteProjectAdmin(projectId: string): Promise<void> {
    for (const [id, s] of this.submissionsMap) {
      if (s.projectId === projectId) this.submissionsMap.delete(id);
    }
    this.projects.delete(projectId);
  }

  async getAllSubscriptions(): Promise<(Subscription & { userEmail?: string })[]> {
    return [...this.subscriptions.values()].map(s => ({
      ...s,
      userEmail: this.users.get(s.userId)?.email,
    }));
  }

  async getRecentActivity(limit = 20): Promise<any[]> {
    const activities: any[] = [];
    for (const p of this.projects.values()) {
      const u = this.users.get(p.userId);
      activities.push({ type: "project_created", description: `${u?.email || "User"} created project "${p.name}"`, timestamp: p.createdAt });
    }
    for (const t of this.supportTicketsMap.values()) {
      const u = this.users.get(t.userId);
      activities.push({ type: "ticket_created", description: `${u?.email || "User"} opened ticket: ${t.subject}`, timestamp: t.createdAt });
    }
    for (const s of this.submissionsMap.values()) {
      const u = this.users.get(s.userId);
      activities.push({ type: "submission_created", description: `${u?.email || "User"} submitted a project for review`, timestamp: s.createdAt });
    }
    for (const a of this.automationLogsMap.values()) {
      activities.push({ type: "automation_run", description: `Job "${a.jobName}" ${a.status}`, timestamp: a.startedAt });
    }
    activities.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    return activities.slice(0, limit);
  }

  async createAutomationLog(jobName: string, triggeredBy: string): Promise<AutomationLog> {
    const log: AutomationLog = {
      id: randomUUID(),
      jobName,
      triggeredBy,
      status: "running",
      message: null,
      startedAt: new Date(),
      completedAt: null,
    };
    this.automationLogsMap.set(log.id, log);
    return log;
  }

  async updateAutomationLog(id: string, status: string, message: string): Promise<void> {
    const log = this.automationLogsMap.get(id);
    if (log) this.automationLogsMap.set(id, { ...log, status, message, completedAt: new Date() });
  }

  async getAutomationLogs(limit = 50): Promise<AutomationLog[]> {
    return [...this.automationLogsMap.values()]
      .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime())
      .slice(0, limit);
  }

  async resetAiUsage(): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    let count = 0;
    for (const key of [...this.aiUsageMap.keys()]) {
      if (!key.endsWith(`:${today}`)) {
        this.aiUsageMap.delete(key);
        count++;
      }
    }
    return count;
  }

  async expireSubscriptions(): Promise<number> {
    let count = 0;
    for (const [userId, sub] of this.subscriptions) {
      if (sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
        this.subscriptions.set(userId, { ...sub, status: "expired", updatedAt: new Date() });
        count++;
      }
    }
    return count;
  }

  async cleanupPendingPayments(): Promise<number> {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    let count = 0;
    for (const [userId, sub] of this.subscriptions) {
      if (sub.status === "pending" && sub.createdAt && sub.createdAt < thirtyMinAgo) {
        this.subscriptions.set(userId, { ...sub, status: "failed", updatedAt: new Date() });
        count++;
      }
    }
    return count;
  }

  async createUserQuery(data: InsertUserQuery): Promise<UserQuery> {
    const query: UserQuery = { id: randomUUID(), status: "pending", adminReply: null, createdAt: new Date(), updatedAt: new Date(), ...data };
    this.userQueriesMap.set(query.id, query);
    return query;
  }

  async getAllUserQueries(): Promise<UserQuery[]> {
    return Array.from(this.userQueriesMap.values()).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async updateUserQueryReply(id: string, reply: string): Promise<void> {
    const query = this.userQueriesMap.get(id);
    if (query) {
      query.adminReply = reply;
      query.status = "answered";
      query.updatedAt = new Date();
    }
  }

  async getSiteSettings(): Promise<SiteSettings> {
    let settings = this.siteSettingsMap.get(1);
    if (!settings) {
      settings = { id: 1, contactEmail: "support@pixel-prompt.app", contactPhone: "+1 (555) 000-0000", contactAddress: "PixelPrompt HQ, San Francisco, CA", updatedAt: new Date() };
      this.siteSettingsMap.set(1, settings);
    }
    return settings;
  }

  async updateSiteSettings(data: Partial<InsertSiteSettings>): Promise<SiteSettings> {
    const settings = await this.getSiteSettings();
    const updated = { ...settings, ...data, updatedAt: new Date() };
    this.siteSettingsMap.set(1, updated);
    return updated;
  }
}

export const storage: IStorage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new InMemoryStorage();
