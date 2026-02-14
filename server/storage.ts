import { eq, and, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  users, projects, subscriptions, aiUsage, submissions,
  type User, type InsertUser, type Project, type InsertProject,
  type Subscription, type AiUsage, type Submission, type InsertSubmission,
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
}

export const storage = new DatabaseStorage();
