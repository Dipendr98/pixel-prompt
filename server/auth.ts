import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import type { Express, Request } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import createMemoryStore from "memorystore";
import pg from "pg";
import { sendWelcomeEmail, sendPasswordResetEmail } from "./mail";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

declare global {
  namespace Express {
    interface User extends Omit<import("@shared/schema").User, "password"> { }
  }
}

export function setupAuth(app: Express) {
  let sessionStore: session.Store;
  if (process.env.DATABASE_URL) {
    const PgStore = connectPgSimple(session);
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    sessionStore = new PgStore({ pool, createTableIfMissing: true });
  } else {
    const MemoryStore = createMemoryStore(session);
    sessionStore = new MemoryStore({ checkPeriod: 86400000 });
  }

  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "builder-pro-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) return done(null, false, { message: "Invalid email or password" });
          const valid = await comparePasswords(password, user.password);
          if (!valid) return done(null, false, { message: "Invalid email or password" });
          const { password: _, ...userWithoutPassword } = user;
          return done(null, userWithoutPassword);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      const { password: _, ...userWithoutPassword } = user;
      done(null, userWithoutPassword);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ message: "Email and password required" });
      if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(400).json({ message: "Email already registered" });

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({ email, password: hashedPassword });
      const { password: _, ...userWithoutPassword } = user;

      // Send Welcome Email
      await sendWelcomeEmail(user.email);

      req.login(userWithoutPassword, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after signup" });
        res.json(userWithoutPassword);
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Signup failed" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email required" });

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // We still return ok to prevent email enumeration
        return res.json({ ok: true });
      }

      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 3600000); // 1 hour
      await storage.updateUserResetToken(user.id, token, expires);

      await sendPasswordResetEmail(user.email, token);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to process forgot password" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ message: "Token and password required" });
      if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

      const user = await storage.getUserByResetToken(token);
      if (!user || !user.resetPasswordExpires || new Date() > new Date(user.resetPasswordExpires)) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      const hashedPassword = await hashPassword(password);
      await storage.updateUserPassword(user.id, hashedPassword);
      await storage.updateUserResetToken(user.id, null, null);

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to reset password" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Login failed" });
      req.login(user, (err) => {
        if (err) return next(err);
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const subscription = await storage.getSubscription(req.user.id);
    res.json({ ...req.user, subscription });
  });
}

export function requireAuth(req: Request, res: any, next: any) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function requireAdmin(req: Request, res: any, next: any) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
