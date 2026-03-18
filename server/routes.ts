import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin } from "./auth";
import { nanoid } from "nanoid";
import crypto from "crypto";
import { migrateProjectSchema } from "@shared/schema";
import type { ProjectData, PageData } from "@shared/schema";
import path from "path";
import fs from "fs";
import { sendPaymentSuccessEmail, sendQueryNotificationToAdmin, sendQueryResponseToUser } from "./mail";
import { orchestrate, parseCVText, buildPortfolioBlocksFromCV, type ProgressEvent as OrchestratorEvent } from "./ai/orchestrator.js";

// ── Shared multipart helpers ──────────────────────────────────────────────────

function readRawBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("binary")));
    req.on("error", reject);
  });
}

function extractMultipartField(body: string, contentType: string, fieldName: string): string {
  const boundary = contentType.split("boundary=")[1];
  if (!boundary) return "";
  for (const part of body.split("--" + boundary)) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    if (!part.substring(0, headerEnd).includes(`name="${fieldName}"`)) continue;
    const raw = part.substring(headerEnd + 4);
    return raw.endsWith("\r\n") ? raw.slice(0, -2) : raw;
  }
  return "";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // --- Healthcheck endpoint for Railway ---
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // --- DEV ONLY: Promote current user to admin ---
  // Only available in development to prevent privilege escalation in production
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/make-admin", requireAuth, async (req, res) => {
      try {
        const userId = req.user!.id;
        await storage.updateUserRole(userId, "admin");
        res.json({ ok: true, message: "You are now an admin! Refresh the page." });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    });

    app.get("/api/make-admin-easy", requireAuth, async (req, res) => {
      try {
        const userId = req.user!.id;
        await storage.updateUserRole(userId, "admin");
        res.send(`<h1>Success! You are now an Admin.</h1><p>Go back to <a href="/admin/submissions">Admin Submissions</a></p>`);
      } catch (err: any) {
        res.status(500).send("Error: " + err.message);
      }
    });
  }

  // --- File Upload ---
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use("/uploads", (await import("express")).default.static(uploadsDir));

  const ALLOWED_UPLOAD_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"]);
  const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

  app.post("/api/upload", requireAuth, async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      req.on("data", (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > MAX_UPLOAD_SIZE) {
          res.status(413).json({ message: "File too large (max 5 MB)" });
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        if (res.headersSent) return;
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers["content-type"] || "";
        const boundary = contentType.split("boundary=")[1];
        if (!boundary) { res.status(400).json({ message: "No multipart boundary" }); return; }
        const parts = buffer.toString("binary").split("--" + boundary);
        for (const part of parts) {
          const headerEnd = part.indexOf("\r\n\r\n");
          if (headerEnd < 0) continue;
          const headers = part.substring(0, headerEnd);
          const filenameMatch = headers.match(/filename="([^"]+)"/);
          if (!filenameMatch) continue;
          const ext = path.extname(filenameMatch[1]).toLowerCase() || ".png";
          if (!ALLOWED_UPLOAD_EXTS.has(ext)) {
            res.status(400).json({ message: `File type ${ext} not allowed. Use: ${[...ALLOWED_UPLOAD_EXTS].join(", ")}` });
            return;
          }
          const fname = nanoid(12) + ext;
          const body = part.substring(headerEnd + 4);
          const trimmed = body.endsWith("\r\n") ? body.slice(0, -2) : body;
          fs.writeFileSync(path.join(uploadsDir, fname), trimmed, "binary");
          res.json({ url: "/uploads/" + fname });
          return;
        }
        res.status(400).json({ message: "No file found in upload" });
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjects(req.user!.id);
      res.json(projects);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id as string, req.user!.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      res.json(project);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const { name, schema } = req.body;
      if (!name) return res.status(400).json({ message: "Name required" });
      const project = await storage.createProject(req.user!.id, { name, schema: schema || [] });
      res.json(project);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id as string, req.user!.id, req.body);
      if (!project) return res.status(404).json({ message: "Project not found" });
      res.json(project);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id as string, req.user!.id);
      if (!deleted) return res.status(404).json({ message: "Project not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── AI endpoint: streams NDJSON progress events then final result ─────────
  app.post("/api/ai", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ message: "Prompt required (must be a string)" });
      }

      const sub = await storage.getSubscription(userId);
      const isPro = sub?.status === "active";
      const today = new Date().toISOString().split("T")[0];

      if (!isPro) {
        const usage = await storage.getAiUsage(userId, today);
        if (usage >= 3) {
          return res.status(429).json({
            message: "Daily AI limit reached (3/day). Upgrade to Pro for unlimited.",
          });
        }
      }

      // Detect if client wants streaming (NDJSON) or classic JSON
      const wantsStream = req.headers["accept"] === "application/x-ndjson";

      if (wantsStream) {
        // ── Streaming mode: emit agent progress in real-time ──────────────
        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader("Transfer-Encoding", "chunked");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("X-Accel-Buffering", "no"); // Nginx: disable buffering
        res.flushHeaders(); // send headers immediately for real-time streaming

        const writeEvent = (event: OrchestratorEvent) => {
          if (!res.writableEnded) {
            res.write(JSON.stringify(event) + "\n");
          }
        };

        try {
          const result = await orchestrate(prompt, writeEvent);
          // Only deduct usage credit after successful generation
          await storage.incrementAiUsage(userId, today);
          if (!res.writableEnded) {
            res.write(
              JSON.stringify({
                type: "complete",
                blocks: result.blocks,
                message: result.message,
                plan: result.plan,
                tasks: result.tasks,
              }) + "\n"
            );
          }
        } catch (err: any) {
          if (!res.writableEnded) {
            res.write(JSON.stringify({ type: "error", message: err.message, fatal: true }) + "\n");
          }
        } finally {
          res.end();
        }
      } else {
        // ── Classic mode: collect all progress, return final JSON ─────────
        const result = await orchestrate(prompt);
        await storage.incrementAiUsage(userId, today);
        res.json({ message: result.message, blocks: result.blocks, plan: result.plan });
      }
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ message: err.message });
      }
    }
  });

  // ── CV Upload & Parse endpoint ──────────────────────────────────────────────
  app.post("/api/ai/cv-parse", requireAuth, async (req, res) => {
    try {
      const body = await readRawBody(req);
      const cvText = extractMultipartField(body, req.headers["content-type"] || "", "cv");

      if (!cvText || cvText.trim().length < 50) {
        return res.status(400).json({ message: "CV content is too short or unreadable. Please upload a plain text (.txt) or markdown (.md) file." });
      }

      const parsed = await parseCVText(cvText);
      const blocks = buildPortfolioBlocksFromCV(parsed);
      res.json({ ...parsed, blocks });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/razorpay/order", requireAuth, async (req, res) => {
    try {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret) {
        return res.json({ disabled: true, message: "Razorpay keys not configured" });
      }

      const Razorpay = (await import("razorpay")).default;
      const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

      const order = await rzp.orders.create({
        amount: 900 * 100,
        currency: "INR",
        receipt: `order_${nanoid(8)}`,
        notes: { userId: req.user!.id, plan: "pro" },
      });

      await storage.upsertSubscription(req.user!.id, { status: "pending" });

      res.json({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: keyId,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/razorpay/verify", requireAuth, async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keySecret) return res.status(400).json({ message: "Razorpay not configured" });

      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await storage.upsertSubscription(req.user!.id, {
        status: "active",
        provider: "razorpay",
        razorpaySubscriptionId: razorpay_payment_id,
        currentPeriodEnd: periodEnd,
      });

      // Send Payment Success Email
      await sendPaymentSuccessEmail(req.user!.email, 900 * 100);

      res.json({ ok: true, status: "active" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/queries", async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: "All fields are required" });
      }
      const query = await storage.createUserQuery({ name, email, subject, message });
      await sendQueryNotificationToAdmin(name, email, subject, message);
      res.json(query);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/queries", requireAdmin, async (req, res) => {
    try {
      const queries = await storage.getAllUserQueries();
      res.json(queries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/queries/:id/respond", requireAdmin, async (req, res) => {
    try {
      const { reply } = req.body;
      if (!reply) return res.status(400).json({ message: "Reply message required" });

      const queries = await storage.getAllUserQueries();
      const query = queries.find((q: any) => q.id === req.params.id);
      if (!query) return res.status(404).json({ message: "Query not found" });

      await storage.updateUserQueryReply(query.id, reply);
      await sendQueryResponseToUser(query.email, query.subject, reply);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/site-settings", async (req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/site-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.updateSiteSettings(req.body);
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/razorpay/webhook", async (req, res) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) return res.status(200).json({ ok: true });

      const signature = req.headers["x-razorpay-signature"] as string;
      if (!signature) return res.status(400).json({ message: "No signature" });

      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (expectedSignature !== signature) {
        return res.status(400).json({ message: "Invalid webhook signature" });
      }

      const event = req.body.event;
      const payload = req.body.payload;

      if (event === "payment.captured") {
        const notes = payload?.payment?.entity?.notes;
        if (notes?.userId) {
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          await storage.upsertSubscription(notes.userId, {
            status: "active",
            provider: "razorpay",
            currentPeriodEnd: periodEnd,
          });
        }
      }

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/export/:projectId", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const sub = await storage.getSubscription(userId);

      const project = await storage.getProject(req.params.projectId as string, userId);
      if (!project) return res.status(404).send("Project not found");

      const data = migrateProjectSchema(project.schema);
      const css = generateCSS(data.settings || {});

      const JSZip = (await import("jszip")).default;
      const beautify = (await import("js-beautify")).default;
      const zip = new JSZip();

      // Format and add CSS
      const formattedCss = beautify.css(css, { indent_size: 2 });
      zip.folder("css")?.file("style.css", formattedCss);

      // Create and format JS snippet
      const scriptJs = `
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const anim = entry.target.getAttribute('data-animate');
              if (anim) entry.target.classList.add('animate-' + anim);
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.1 });
        document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
      `;
      const formattedJs = beautify.js(scriptJs, { indent_size: 2 });
      zip.folder("js")?.file("script.js", formattedJs);

      // Generate pages
      for (const page of data.pages) {
        const bodyHtml = generatePageHtml(page.blocks);
        const filename = page.path === "/" ? "index.html" : page.path.replace(/^\//, "") + ".html";
        const seo = page.seo || {};

        const rawHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${escHtml(seo.title || page.name + " - " + project.name)}</title>\n  ${seo.description ? `<meta name="description" content="${escHtml(seo.description)}">` : ""}\n  ${seo.ogImage ? `<meta property="og:image" content="${escHtml(seo.ogImage)}">` : ""}\n  <link rel="stylesheet" href="css/style.css">\n</head>\n<body>\n${bodyHtml}\n<script src="js/script.js"></script>\n</body>\n</html>`;

        // Let js-beautify handle all indentation and spacing beautifully
        const formattedHtml = beautify.html(rawHtml, {
          indent_size: 2,
          preserve_newlines: true,
          max_preserve_newlines: 1,
          wrap_line_length: 120
        });

        zip.file(filename, formattedHtml);
      }

      const buffer = await zip.generateAsync({ type: "nodebuffer" });
      const downloadName = (project.name === project.id || project.name.length >= 30) ? "PixelPrompt-Export" : project.name;
      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${downloadName}.zip"`,
      });
      res.send(buffer);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  // Export as Next.js React Application
  app.get("/api/export-next/:projectId", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const project = await storage.getProject(req.params.projectId as string, userId);
      if (!project) return res.status(404).send("Project not found");

      const data = migrateProjectSchema(project.schema);
      const css = generateCSS(data.settings || {});

      const JSZip = (await import("jszip")).default;
      const beautify = (await import("js-beautify")).default;
      const zip = new JSZip();

      // Convert HTML strings to JSX
      const htmlToJsx = (html: string) => {
        return html
          .replace(/class=/g, "className=")
          .replace(/for=/g, "htmlFor=")
          .replace(/frameborder="0"/g, 'frameBorder="0"')
          .replace(/allowfullscreen/g, "allowFullScreen")
          .replace(/<!--([\s\S]*?)-->/g, "{/*$1*/}")
          .replace(/style="([^"]*)"/g, (match, styleString) => {
            const styleObj: Record<string, string> = {};
            styleString.split(';').forEach((rule: string) => {
              if (!rule.trim()) return;
              const parts = rule.split(':');
              if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join(':').trim();
                const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                styleObj[camelKey] = value;
              }
            });
            return `style={${JSON.stringify(styleObj)}}`;
          });
      };

      // Boilerplate package.json
      const packageJson = {
        name: project.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        version: "0.1.0",
        private: true,
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start"
        },
        dependencies: {
          "next": "14.2.3",
          "react": "^18",
          "react-dom": "^18"
        },
        devDependencies: {
          "@types/node": "^20",
          "@types/react": "^18",
          "@types/react-dom": "^18",
          "typescript": "^5"
        }
      };
      zip.file("package.json", JSON.stringify(packageJson, null, 2));

      // Boilerplate config files
      zip.file("tsconfig.json", JSON.stringify({
        compilerOptions: { lib: ["dom", "dom.iterable", "esnext"], allowJs: true, skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true, module: "esnext", moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "preserve", incremental: true, plugins: [{ name: "next" }], paths: { "@/*": ["./*"] } },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"]
      }, null, 2));

      zip.file("next.config.mjs", `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nexport default nextConfig;\n`);

      // CSS and Layout
      zip.folder("app")?.file("globals.css", beautify.css(css, { indent_size: 2 }));

      const layoutTsx = `import type { Metadata } from 'next'\nimport './globals.css'\n\nexport const metadata: Metadata = {\n  title: '${escHtml(project.name)}',\n  description: 'Generated by PixelPrompt AI',\n}\n\nexport default function RootLayout({\n  children,\n}: {\n  children: React.ReactNode\n}) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n`;
      zip.folder("app")?.file("layout.tsx", layoutTsx);

      // Generate Pages
      for (const page of data.pages) {
        const bodyHtml = generatePageHtml(page.blocks);
        const bodyJsx = htmlToJsx(bodyHtml);

        const folderName = page.path === "/" ? "app" : `app${page.path.replace(/\/$/, "")}`;

        let clientComponentWrapper = `"use client";\n\nimport { useEffect } from "react";\n\nexport default function Page() {\n  useEffect(() => {\n    const observer = new IntersectionObserver((entries) => {\n      entries.forEach(entry => {\n        if (entry.isIntersecting) {\n          const anim = entry.target.getAttribute('data-animate');\n          if (anim) entry.target.classList.add('animate-' + anim);\n          observer.unobserve(entry.target);\n        }\n      });\n    }, { threshold: 0.1 });\n    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));\n    return () => observer.disconnect();\n  }, []);\n\n  return (\n    <main>\n      ${bodyJsx}\n    </main>\n  );\n}\n`;

        const formattedComponent = beautify.js(clientComponentWrapper, { indent_size: 2, e4x: true });
        zip.folder(folderName)?.file("page.tsx", formattedComponent);
      }

      const buffer = await zip.generateAsync({ type: "nodebuffer" });
      const downloadName = (project.name === project.id || project.name.length >= 30) ? "PixelPrompt-NextJS" : `${project.name}-nextjs`;
      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${downloadName}.zip"`,
      });
      res.send(buffer);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  app.get("/api/submissions", requireAuth, async (req, res) => {
    try {
      const subs = await storage.getSubmissions(req.user!.id);
      res.json(subs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/submissions", requireAuth, async (req, res) => {
    try {
      const { projectId, notes } = req.body;
      if (!projectId) return res.status(400).json({ message: "Project ID required" });

      const project = await storage.getProject(projectId, req.user!.id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const sub = await storage.createSubmission(req.user!.id, { projectId, notes: notes || "" });
      res.json(sub);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/submissions", requireAdmin, async (req, res) => {
    try {
      const subs = await storage.getAllSubmissions();
      res.json(subs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/submissions/:id", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) return res.status(400).json({ message: "Status required" });
      await storage.updateSubmissionStatus(req.params.id as string, status);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/support", requireAuth, async (req, res) => {
    try {
      const tickets = await storage.getSupportTickets(req.user!.id);
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/support", requireAuth, async (req, res) => {
    try {
      const { subject, message } = req.body;
      if (!subject || !message) return res.status(400).json({ message: "Subject and message required" });
      const ticket = await storage.createSupportTicket(req.user!.id, { subject, message });
      res.json(ticket);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/tickets", requireAdmin, async (req, res) => {
    try {
      const tickets = await storage.getAllSupportTickets();
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/tickets/:id", requireAdmin, async (req, res) => {
    try {
      const { status, adminReply } = req.body;
      const update: any = { updatedAt: new Date() };
      if (status) update.status = status;
      if (adminReply !== undefined) update.adminReply = adminReply;
      await storage.updateSupportTicket(req.params.id as string, update);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/projects", requireAdmin, async (req, res) => {
    try {
      const allProjects = await storage.getAllProjects();
      res.json(allProjects);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/automations/logs", requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getAutomationLogs(100);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    try {
      const { role } = req.body;
      if (!role || !["user", "admin"].includes(role)) return res.status(400).json({ message: "Invalid role" });
      if (req.params.id === req.user!.id) return res.status(400).json({ message: "Cannot change your own role" });
      await storage.updateUserRole(req.params.id as string, role);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      if (req.params.id === req.user!.id) return res.status(400).json({ message: "Cannot delete yourself" });
      await storage.deleteUserAdmin(req.params.id as string);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/projects/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteProjectAdmin(req.params.id as string);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/subscriptions", requireAdmin, async (req, res) => {
    try {
      const subs = await storage.getAllSubscriptions();
      res.json(subs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/activity", requireAdmin, async (req, res) => {
    try {
      const activity = await storage.getRecentActivity(20);
      res.json(activity);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/automations/run", requireAdmin, async (req, res) => {
    try {
      const { jobName } = req.body;
      if (!jobName) return res.status(400).json({ message: "Job name required" });

      const validJobs = ["reset_ai_usage", "check_subscriptions", "cleanup_pending_payments"];
      if (!validJobs.includes(jobName)) {
        return res.status(400).json({ message: `Invalid job. Must be one of: ${validJobs.join(", ")}` });
      }

      const log = await storage.createAutomationLog(jobName, req.user!.email);

      try {
        let affectedCount = 0;
        let resultMessage = "";

        switch (jobName) {
          case "reset_ai_usage":
            affectedCount = await storage.resetAiUsage();
            resultMessage = `AI usage reset completed. ${affectedCount} old records removed.`;
            break;
          case "check_subscriptions":
            affectedCount = await storage.expireSubscriptions();
            resultMessage = `Subscription check completed. ${affectedCount} subscriptions expired.`;
            break;
          case "cleanup_pending_payments":
            affectedCount = await storage.cleanupPendingPayments();
            resultMessage = `Pending payments cleanup completed. ${affectedCount} stale payments marked as failed.`;
            break;
        }

        await storage.updateAutomationLog(log.id, "success", resultMessage);
        res.json({ status: "success", message: resultMessage, logId: log.id });
      } catch (jobErr: any) {
        await storage.updateAutomationLog(log.id, "failed", jobErr.message);
        res.status(500).json({ status: "failed", message: jobErr.message, logId: log.id });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subscription/cancel", requireAuth, async (req, res) => {
    try {
      await storage.cancelSubscription(req.user!.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}



function generatePageHtml(blocks: any[]): string {
  let bodyHtml = "";
  for (const block of blocks) {
    const props = block.props || {};
    const styleAttr = block.style ? ` style="${Object.entries(block.style)
      .filter(([k, v]) => v && !k.startsWith('animation') && k !== 'customCss')
      .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';')}${block.style.customCss ? ';' + block.style.customCss : ''}"` : "";

    // Animation attributes
    const animType = block.style?.animation && block.style.animation !== "none" ? block.style.animation : "";
    const animDuration = block.style?.animationDuration || "0.6s";
    const animDelay = block.style?.animationDelay || "0s";

    // Opening wrapper for animation if needed
    if (animType) {
      bodyHtml += `<div data-animate="${animType}" style="animation-duration: ${animDuration}; animation-delay: ${animDelay}; opacity: 0;">\n`;
    }

    // Wrap the inner switch content in a div to hold the standard styleAttr
    bodyHtml += `<div${styleAttr}>\n`;
    switch (block.type) {
      case "navbar":
        const navLinks = (props.links || []).map((l: any) => `<a href="${escHtml(l.url || "#")}">${escHtml(l.label)}</a>`).join("");
        bodyHtml += `<nav class="navbar"><div class="nav-brand">${escHtml(props.brand || "Brand")}</div><div class="nav-links">${navLinks}${props.ctaText ? `<a href="#" class="btn btn-sm">${escHtml(props.ctaText)}</a>` : ""}</div></nav>\n`;
        break;
      case "hero":
        bodyHtml += `<section class="hero"><h1>${escHtml(props.title || "Hero")}</h1><p>${escHtml(props.subtitle || "")}</p>${props.buttonText ? `<a href="#" class="btn">${escHtml(props.buttonText)}</a>` : ""}</section>\n`;
        break;
      case "heading":
        bodyHtml += `<h2 class="heading" style="text-align:${props.align || "left"}">${escHtml(props.text || "Heading")}</h2>\n`;
        break;
      case "text":
        bodyHtml += `<p class="text-block" style="text-align:${props.align || "left"}">${escHtml(props.text || "")}</p>\n`;
        break;
      case "button":
        bodyHtml += `<div class="button-wrap" style="text-align:${props.align || "left"}"><a href="${escHtml(props.url || "#")}" class="btn">${escHtml(props.text || "Button")}</a></div>\n`;
        break;
      case "image":
        bodyHtml += `<div class="image-block"><img src="${escHtml(props.src || "https://placehold.co/800x400")}" alt="${escHtml(props.alt || "")}" style="height:${props.height || "200px"};width:100%;object-fit:cover;" /></div>\n`;
        break;
      case "divider":
        bodyHtml += `<hr class="divider" />\n`;
        break;
      case "spacer":
        bodyHtml += `<div style="height:${props.height || "40px"}"></div>\n`;
        break;
      case "section":
        bodyHtml += `<section class="content-section"><h3>${escHtml(props.title || "Section")}</h3></section>\n`;
        break;
      case "features": {
        const features = props.features || [];
        bodyHtml += `<div class="features-grid">${features.map((f: any) => `<div class="feature-card"><h4>${escHtml(f.title || "")}</h4><p>${escHtml(f.desc || "")}</p></div>`).join("")}</div>\n`;
        break;
      }
      case "footer": {
        const cols = (props.columns || []).map((col: any) => `<div class="footer-col"><h4>${escHtml(col.title || "")}</h4>${(col.links || []).map((l: string) => `<a href="#">${escHtml(l)}</a>`).join("")}</div>`).join("");
        bodyHtml += `<footer class="site-footer"><div class="footer-grid">${cols}</div><div class="footer-bottom">${escHtml(props.copyright || "")}</div></footer>\n`;
        break;
      }
      case "product-card": {
        const products = (props.products || []).map((p: any) => `<div class="product-card"><div class="product-img"><img src="${escHtml(p.image || "https://placehold.co/300x200")}" alt="${escHtml(p.name || "")}" /></div><div class="product-info"><h4>${escHtml(p.name || "")}</h4><p>${escHtml(p.description || "")}</p><div class="product-footer"><span class="price">${escHtml(p.price || "")}</span><a href="#" class="btn btn-sm">Add to Cart</a></div></div></div>`).join("");
        bodyHtml += `<div class="products-grid">${products}</div>\n`;
        break;
      }
      case "pricing-table": {
        const plans = (props.plans || []).map((p: any) => `<div class="pricing-card${p.highlighted ? " highlighted" : ""}"><h4 class="plan-name">${escHtml(p.name || "")}</h4><div class="plan-price">${escHtml(p.price || "")}</div><ul class="plan-features">${(p.features || []).map((f: string) => `<li>${escHtml(f)}</li>`).join("")}</ul><a href="#" class="btn${p.highlighted ? "" : " btn-outline"}">${escHtml(p.cta || "Choose Plan")}</a></div>`).join("");
        bodyHtml += `<div class="pricing-grid">${plans}</div>\n`;
        break;
      }
      case "contact-form":
        bodyHtml += `<div class="contact-form-wrap"><h3>${escHtml(props.title || "Contact Us")}</h3><p class="subtitle">${escHtml(props.subtitle || "")}</p><form class="contact-form"><input type="text" placeholder="Your Name" /><input type="email" placeholder="Email Address" /><textarea placeholder="Your Message" rows="4"></textarea><button type="submit" class="btn">${escHtml(props.buttonText || "Send")}</button></form></div>\n`;
        break;
      case "testimonials": {
        const testimonials = (props.testimonials || []).map((t: any) => `<div class="testimonial-card"><blockquote>"${escHtml(t.quote || "")}"</blockquote><div class="testimonial-author"><strong>${escHtml(t.name || "")}</strong><span>${escHtml(t.role || "")}</span></div></div>`).join("");
        bodyHtml += `<div class="testimonials-grid">${testimonials}</div>\n`;
        break;
      }
      case "gallery": {
        const count = props.count || 8;
        const imgs = Array.from({ length: count }).map((_, i) => `<div class="gallery-item"><img src="https://placehold.co/300x300?text=Image+${i + 1}" alt="Gallery image ${i + 1}" /></div>`).join("");
        bodyHtml += `<div class="gallery-grid">${imgs}</div>\n`;
        break;
      }
      case "video":
        if (props.url && (props.url.includes("youtube") || props.url.includes("youtu.be"))) {
          const videoId = props.url.match(/(?:v=|youtu\.be\/)([\w-]+)/)?.[1] || "";
          bodyHtml += `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen style="width:100%;height:${props.height || "400px"}"></iframe></div>\n`;
        } else {
          bodyHtml += `<div class="video-embed" style="height:${props.height || "400px"};display:flex;align-items:center;justify-content:center;background:#f3f4f6;border-radius:8px"><p>Video placeholder</p></div>\n`;
        }
        break;
      case "faq": {
        bodyHtml += `<div class="faq-section"><h3>${escHtml(props.title || "FAQ")}</h3>`;
        for (const item of props.items || []) {
          bodyHtml += `<details class="faq-item"><summary>${escHtml(item.question || "")}</summary><p>${escHtml(item.answer || "")}</p></details>`;
        }
        bodyHtml += `</div>\n`;
        break;
      }
      case "stats": {
        const stats = (props.stats || []).map((s: any) => `<div class="stat-item"><div class="stat-value">${escHtml(s.value || "")}</div><div class="stat-label">${escHtml(s.label || "")}</div></div>`).join("");
        bodyHtml += `<div class="stats-grid">${stats}</div>\n`;
        break;
      }
      case "team": {
        const members = (props.members || []).map((m: any) => `<div class="team-card"><div class="team-avatar">${(m.name || "A")[0]}</div><h4>${escHtml(m.name || "")}</h4><span class="team-role">${escHtml(m.role || "")}</span><p>${escHtml(m.bio || "")}</p></div>`).join("");
        bodyHtml += `<div class="team-grid">${members}</div>\n`;
        break;
      }
      case "social-links": {
        const links = (props.links || []).map((s: any) => `<a href="${escHtml(s.url || "#")}" class="social-link">${escHtml(s.platform || "")}</a>`).join("");
        bodyHtml += `<div class="social-links">${links}</div>\n`;
        break;
      }
      case "banner":
        bodyHtml += `<div class="banner banner-${props.variant || "info"}"><p>${escHtml(props.text || "")}${props.linkText ? ` <a href="#">${escHtml(props.linkText)}</a>` : ""}</p></div>\n`;
        break;
      case "countdown":
        bodyHtml += `<div class="countdown-section"><h3>${escHtml(props.title || "")}</h3><div class="countdown-timer" data-target="${escHtml(props.targetDate || "")}"><div class="countdown-unit"><span>00</span><small>Days</small></div><div class="countdown-unit"><span>00</span><small>Hours</small></div><div class="countdown-unit"><span>00</span><small>Min</small></div><div class="countdown-unit"><span>00</span><small>Sec</small></div></div><p>${escHtml(props.subtitle || "")}</p></div>\n`;
        break;
      case "newsletter":
        bodyHtml += `<div class="newsletter-section"><h3>${escHtml(props.title || "")}</h3><p>${escHtml(props.subtitle || "")}</p><form class="newsletter-form"><input type="email" placeholder="Enter your email" /><button type="submit" class="btn">${escHtml(props.buttonText || "Subscribe")}</button></form></div>\n`;
        break;
      case "logo-cloud": {
        const logos = (props.logos || []).map((l: string) => `<div class="logo-item">${escHtml(l)}</div>`).join("");
        bodyHtml += `<div class="logo-cloud"><p class="logo-title">${escHtml(props.title || "")}</p><div class="logo-grid">${logos}</div></div>\n`;
        break;
      }
      case "cta":
        bodyHtml += `<div class="cta-section"><h3>${escHtml(props.title || "")}</h3><p>${escHtml(props.subtitle || "")}</p><div class="cta-buttons"><a href="#" class="btn">${escHtml(props.primaryButton || "Get Started")}</a>${props.secondaryButton ? `<a href="#" class="btn btn-outline">${escHtml(props.secondaryButton)}</a>` : ""}</div></div>\n`;
        break;
      case "blog-post":
        bodyHtml += `<article class="blog-post-card"><div class="blog-img"><img src="${escHtml(props.image || "https://placehold.co/600x300")}" alt="${escHtml(props.title || "")}" /></div><div class="blog-body"><span class="blog-cat">${escHtml(props.category || "General")}</span><h3>${escHtml(props.title || "Blog Post")}</h3><p>${escHtml(props.excerpt || "")}</p><div class="blog-meta"><span>${escHtml(props.author || "Author")}</span><span>${escHtml(props.date || "")}</span></div></div></article>\n`;
        break;
      case "blog-list": {
        const posts = (props.posts || []).map((p: any) => `<div class="blog-post-card"><div class="blog-img"><img src="https://placehold.co/400x200" alt="${escHtml(p.title || "")}" /></div><div class="blog-body"><span class="blog-cat">${escHtml(p.category || "")}</span><h4>${escHtml(p.title || "")}</h4><p>${escHtml(p.excerpt || "")}</p><div class="blog-meta"><span>${escHtml(p.author || "")}</span><span>${escHtml(p.date || "")}</span></div></div></div>`).join("");
        bodyHtml += `<div class="blog-section">${props.title ? `<h3 class="section-title">${escHtml(props.title)}</h3>` : ""}<div class="blog-grid">${posts}</div></div>\n`;
        break;
      }
      case "cart": {
        const items = (props.items || []).map((it: any) => `<div class="cart-item"><span>${escHtml(it.name || "")}</span><span>x${it.quantity || 1}</span><span>${escHtml(it.price || "")}</span></div>`).join("");
        bodyHtml += `<div class="cart-section"><h3>Shopping Cart</h3>${items}<div class="cart-total"><strong>Total</strong></div>${props.showCheckout !== false ? `<a href="#" class="btn">Proceed to Checkout</a>` : ""}</div>\n`;
        break;
      }
      case "checkout-form":
        bodyHtml += `<div class="contact-form-wrap"><h3>${escHtml(props.title || "Checkout")}</h3><p class="subtitle">${escHtml(props.subtitle || "")}</p><form class="contact-form"><input type="text" placeholder="Full Name" /><input type="email" placeholder="Email" /><input type="text" placeholder="Address" /><input type="text" placeholder="Card Number" /><button type="submit" class="btn">${escHtml(props.buttonText || "Place Order")}</button></form></div>\n`;
        break;
      case "map":
        bodyHtml += `<div class="map-section" style="height:${props.height || "300px"};background:#e5e7eb;display:flex;align-items:center;justify-content:center;border-radius:8px;margin:20px 40px"><p>📍 ${escHtml(props.address || "Location")}</p></div>\n`;
        break;
      case "booking-form":
        bodyHtml += `<div class="contact-form-wrap"><h3>${escHtml(props.title || "Book Now")}</h3><p class="subtitle">${escHtml(props.subtitle || "")}</p><form class="contact-form"><input type="text" placeholder="Your Name" /><input type="email" placeholder="Email" /><input type="date" placeholder="Date" /><select>${(props.services || ["Service"]).map((s: string) => `<option>${escHtml(s)}</option>`).join("")}</select><button type="submit" class="btn">${escHtml(props.buttonText || "Book")}</button></form></div>\n`;
        break;
      case "login-form":
        bodyHtml += `<div class="contact-form-wrap"><h3>${escHtml(props.title || "Sign In")}</h3><p class="subtitle">${escHtml(props.subtitle || "")}</p><form class="contact-form"><input type="email" placeholder="Email" /><input type="password" placeholder="Password" /><button type="submit" class="btn">${escHtml(props.buttonText || "Sign In")}</button></form>${props.showSignup !== false ? `<p style="text-align:center;margin-top:12px;font-size:0.85rem;color:#666">Don't have an account? <a href="#" style="color:#3b82f6">Sign Up</a></p>` : ""}</div>\n`;
        break;
    }

    bodyHtml += `</div>\n`; // Close style wrapper
    if (animType) {
      bodyHtml += `</div>\n`; // Close animation wrapper
    }
  }
  return bodyHtml;
}

function generateCSS(settings: any): string {
  const primary = settings?.primaryColor || "#3b82f6";
  const font = settings?.fontFamily || "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  return `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: ${font}; color: #1a1a1a; line-height: 1.6; overflow-x: hidden; }
a { color: inherit; text-decoration: none; }
img { max-width: 100%; height: auto; }

/* --- Animations --- */
[data-animate] { opacity: 0; animation-fill-mode: forwards; }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes slide-up { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slide-down { from { opacity: 0; transform: translateY(-40px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slide-left { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slide-right { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes zoom-in { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
@keyframes zoom-out { from { opacity: 0; transform: scale(1.2); } to { opacity: 1; transform: scale(1); } }
@keyframes flip { from { opacity: 0; transform: perspective(400px) rotateX(90deg); } to { opacity: 1; transform: perspective(400px) rotateX(0deg); } }
@keyframes bounce { 
  0% { opacity: 0; transform: translateY(60px); } 
  60% { opacity: 1; transform: translateY(-10px); } 
  80% { transform: translateY(5px); } 
  100% { opacity: 1; transform: translateY(0); } 
}
.animate-fade-in { animation-name: fade-in; }
.animate-slide-up { animation-name: slide-up; }
.animate-slide-down { animation-name: slide-down; }
.animate-slide-left { animation-name: slide-left; }
.animate-slide-right { animation-name: slide-right; }
.animate-zoom-in { animation-name: zoom-in; }
.animate-zoom-out { animation-name: zoom-out; }
.animate-flip { animation-name: flip; }
.animate-bounce { animation-name: bounce; }
/* ----------------- */

.navbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 40px; border-bottom: 1px solid #e5e5e5; position: sticky; top: 0; background: white; z-index: 100; }
.nav-brand { font-weight: 700; font-size: 1.25rem; }
.nav-links { display: flex; align-items: center; gap: 24px; }
.nav-links a { font-size: 0.9rem; color: #555; transition: color 0.2s; }
.nav-links a:hover { color: #1a1a1a; }
.hero { background: linear-gradient(135deg, ${primary} 0%, #764ba2 100%); color: white; padding: 80px 40px; text-align: center; }
.hero h1 { font-size: 2.5rem; margin-bottom: 16px; max-width: 700px; margin-left: auto; margin-right: auto; }
.hero p { font-size: 1.1rem; opacity: 0.9; max-width: 600px; margin: 0 auto 24px; }
.btn { display: inline-block; background: ${primary}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; border: none; cursor: pointer; font-size: 0.95rem; transition: background 0.2s; }
.btn:hover { opacity: 0.9; }
.btn-sm { padding: 8px 16px; font-size: 0.85rem; }
.btn-outline { background: transparent; border: 2px solid ${primary}; color: ${primary}; }
.btn-outline:hover { background: ${primary}; color: white; }
.heading { font-size: 1.75rem; padding: 20px 40px; }
.text-block { padding: 10px 40px; color: #4a4a4a; max-width: 800px; }
.button-wrap { padding: 10px 40px; }
.image-block { padding: 20px 40px; }
.image-block img { border-radius: 8px; }
.divider { border: none; border-top: 1px solid #e5e5e5; margin: 20px 40px; }
.content-section { padding: 40px; background: #f8f8f8; }
.features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; padding: 40px; }
.feature-card { background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px; }
.feature-card h4 { margin-bottom: 8px; }
.feature-card p { color: #666; font-size: 0.9rem; }
.products-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; padding: 40px; }
.product-card { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; background: white; }
.product-img img { width: 100%; height: 200px; object-fit: cover; }
.product-info { padding: 16px; }
.product-info h4 { margin-bottom: 4px; }
.product-info p { color: #666; font-size: 0.85rem; margin-bottom: 12px; }
.product-footer { display: flex; align-items: center; justify-content: space-between; }
.price { font-weight: 700; color: ${primary}; font-size: 1.1rem; }
.pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; padding: 40px; }
.pricing-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 32px; text-align: center; background: white; }
.pricing-card.highlighted { border-color: ${primary}; box-shadow: 0 0 0 2px ${primary}; }
.plan-name { text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem; color: #888; margin-bottom: 8px; }
.plan-price { font-size: 2rem; font-weight: 700; margin-bottom: 16px; }
.plan-features { list-style: none; text-align: left; margin-bottom: 24px; }
.plan-features li { padding: 6px 0; font-size: 0.9rem; color: #555; border-bottom: 1px solid #f3f4f6; }
.plan-features li::before { content: "\\2713 "; color: ${primary}; font-weight: 700; margin-right: 8px; }
.contact-form-wrap { max-width: 500px; margin: 0 auto; padding: 40px; }
.contact-form-wrap h3 { font-size: 1.5rem; margin-bottom: 4px; }
.contact-form-wrap .subtitle { color: #666; margin-bottom: 24px; font-size: 0.9rem; }
.contact-form { display: flex; flex-direction: column; gap: 12px; }
.contact-form input, .contact-form textarea, .contact-form select { padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; font-family: inherit; }
.contact-form input:focus, .contact-form textarea:focus { outline: none; border-color: ${primary}; }
.testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; padding: 40px; }
.testimonial-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px; background: white; }
.testimonial-card blockquote { font-style: italic; color: #555; margin-bottom: 16px; font-size: 0.95rem; }
.testimonial-author strong { display: block; }
.testimonial-author span { font-size: 0.85rem; color: #888; }
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; padding: 20px 40px; }
.gallery-item img { width: 100%; height: 200px; object-fit: cover; border-radius: 6px; }
.video-embed { padding: 20px 40px; }
.video-embed iframe { border-radius: 8px; }
.faq-section { max-width: 700px; margin: 0 auto; padding: 40px; }
.faq-section h3 { text-align: center; margin-bottom: 24px; font-size: 1.5rem; }
.faq-item { border: 1px solid #e5e5e5; border-radius: 6px; margin-bottom: 8px; }
.faq-item summary { padding: 14px 16px; font-weight: 500; cursor: pointer; font-size: 0.95rem; }
.faq-item p { padding: 0 16px 14px; color: #666; font-size: 0.9rem; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 24px; padding: 40px; text-align: center; }
.stat-value { font-size: 2rem; font-weight: 700; color: ${primary}; }
.stat-label { font-size: 0.85rem; color: #888; margin-top: 4px; }
.team-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; padding: 40px; text-align: center; }
.team-avatar { width: 60px; height: 60px; border-radius: 50%; background: #e0e7ff; color: ${primary}; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 1.25rem; font-weight: 700; }
.team-card h4 { margin-bottom: 2px; }
.team-role { color: ${primary}; font-size: 0.85rem; }
.team-card p { color: #666; font-size: 0.85rem; margin-top: 8px; }
.social-links { display: flex; justify-content: center; gap: 12px; padding: 20px 40px; }
.social-link { padding: 8px 16px; border-radius: 6px; background: #f3f4f6; color: #555; font-size: 0.85rem; transition: background 0.2s; }
.social-link:hover { background: ${primary}; color: white; }
.banner { padding: 12px 40px; text-align: center; font-size: 0.9rem; }
.banner-info { background: #eff6ff; color: #1e40af; }
.banner-warning { background: #fefce8; color: #854d0e; }
.banner-error { background: #fef2f2; color: #991b1b; }
.banner a { font-weight: 600; text-decoration: underline; margin-left: 8px; }
.countdown-section { text-align: center; padding: 40px; }
.countdown-section h3 { font-size: 1.5rem; margin-bottom: 24px; }
.countdown-timer { display: flex; justify-content: center; gap: 16px; margin-bottom: 16px; }
.countdown-unit { background: #f3f4f6; border-radius: 8px; padding: 16px; min-width: 70px; }
.countdown-unit span { font-size: 1.5rem; font-weight: 700; display: block; }
.countdown-unit small { font-size: 0.75rem; color: #888; }
.countdown-section p { color: #666; font-size: 0.9rem; }
.newsletter-section { text-align: center; padding: 40px; background: #f8f9ff; }
.newsletter-section h3 { font-size: 1.5rem; margin-bottom: 8px; }
.newsletter-section p { color: #666; margin-bottom: 20px; }
.newsletter-form { display: flex; gap: 8px; max-width: 400px; margin: 0 auto; }
.newsletter-form input { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; }
.logo-cloud { text-align: center; padding: 30px 40px; }
.logo-title { font-size: 0.85rem; color: #888; margin-bottom: 16px; }
.logo-grid { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; }
.logo-item { background: #f3f4f6; padding: 10px 20px; border-radius: 6px; font-weight: 500; color: #888; font-size: 0.85rem; }
.cta-section { text-align: center; padding: 60px 40px; background: linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%); }
.cta-section h3 { font-size: 1.75rem; margin-bottom: 8px; }
.cta-section p { color: #555; margin-bottom: 24px; }
.cta-buttons { display: flex; justify-content: center; gap: 12px; }
.blog-section { padding: 40px; }
.section-title { font-size: 1.5rem; text-align: center; margin-bottom: 24px; }
.blog-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
.blog-post-card { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; background: white; }
.blog-img img { width: 100%; height: 200px; object-fit: cover; }
.blog-body { padding: 16px; }
.blog-cat { font-size: 0.75rem; color: ${primary}; text-transform: uppercase; font-weight: 600; }
.blog-body h3, .blog-body h4 { margin: 4px 0 8px; }
.blog-body p { color: #666; font-size: 0.85rem; margin-bottom: 12px; }
.blog-meta { display: flex; justify-content: space-between; font-size: 0.8rem; color: #888; }
.cart-section { max-width: 500px; margin: 0 auto; padding: 40px; }
.cart-section h3 { margin-bottom: 16px; }
.cart-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
.cart-total { padding: 12px 0; text-align: right; }
.map-section { margin: 20px 40px; }
.site-footer { background: #1a1a1a; color: #ccc; padding: 40px; }
.footer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 32px; margin-bottom: 24px; }
.footer-col h4 { color: white; margin-bottom: 12px; font-size: 0.9rem; }
.footer-col a { display: block; color: #999; font-size: 0.85rem; padding: 3px 0; transition: color 0.2s; }
.footer-col a:hover { color: white; }
.footer-bottom { border-top: 1px solid #333; padding-top: 16px; text-align: center; font-size: 0.8rem; color: #888; }
@media (max-width: 768px) {
  .navbar { flex-direction: column; gap: 12px; }
  .hero { padding: 50px 20px; }
  .hero h1 { font-size: 1.75rem; }
  .features-grid, .products-grid, .pricing-grid, .testimonials-grid, .team-grid, .stats-grid, .blog-grid { grid-template-columns: 1fr; padding: 20px; }
  .heading, .text-block, .button-wrap, .image-block { padding-left: 20px; padding-right: 20px; }
}`;
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
