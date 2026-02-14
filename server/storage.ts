import { eq, and, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { desc } from "drizzle-orm";
import {
  users, projects, subscriptions, aiUsage, submissions, supportTickets, automationLogs,
  type User, type InsertUser, type Project, type InsertProject,
  type Subscription, type AiUsage, type Submission, type InsertSubmission,
  type SupportTicket, type InsertSupportTicket, type AutomationLog,
} from "@shared/schema";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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
    const allUsers = await db.select({ id: users.id, email: users.email, role: users.role }).from(users);
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

  async updateUserRole(userId: string, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, userId));
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
}

export const storage = new DatabaseStorage();
