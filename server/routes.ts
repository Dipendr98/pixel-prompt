import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin } from "./auth";
import { nanoid } from "nanoid";
import crypto from "crypto";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

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
      const project = await storage.getProject(req.params.id, req.user!.id);
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
      const project = await storage.updateProject(req.params.id, req.user!.id, req.body);
      if (!project) return res.status(404).json({ message: "Project not found" });
      res.json(project);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id, req.user!.id);
      if (!deleted) return res.status(404).json({ message: "Project not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/ai", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ message: "Prompt required" });

      const sub = await storage.getSubscription(userId);
      const isPro = sub?.status === "active";

      if (!isPro) {
        const today = new Date().toISOString().split("T")[0];
        const usage = await storage.getAiUsage(userId, today);
        if (usage >= 3) {
          return res.status(429).json({ message: "Daily AI limit reached (3/day). Upgrade to Pro for unlimited." });
        }
      }

      const today = new Date().toISOString().split("T")[0];
      await storage.incrementAiUsage(userId, today);

      const blocks = generateMockBlocks(prompt);

      res.json({
        message: `Generated ${blocks.length} block(s) based on your request.`,
        blocks,
      });
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

      res.json({ ok: true, status: "active" });
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
      if (sub?.status !== "active") {
        return res.status(403).send("Export requires Pro subscription");
      }

      const project = await storage.getProject(req.params.projectId, userId);
      if (!project) return res.status(404).send("Project not found");

      const schema = Array.isArray(project.schema) ? (project.schema as any[]) : [];
      const { html, css } = generateStaticSite(project.name, schema);

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file("index.html", html);
      zip.file("styles.css", css);

      const buffer = await zip.generateAsync({ type: "nodebuffer" });
      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.name}.zip"`,
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
      await storage.updateSubmissionStatus(req.params.id, status);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}

function generateMockBlocks(prompt: string): any[] {
  const lower = prompt.toLowerCase();
  const blocks: any[] = [];

  if (lower.includes("hero") || lower.includes("landing") || lower.includes("welcome")) {
    blocks.push({
      id: nanoid(8),
      type: "hero",
      props: {
        title: "Welcome to Our Platform",
        subtitle: "Build something extraordinary with our powerful tools and intuitive interface.",
        buttonText: "Get Started Today",
      },
    });
  }

  if (lower.includes("feature") || lower.includes("service")) {
    blocks.push({
      id: nanoid(8),
      type: "features",
      props: {
        features: [
          { title: "Lightning Fast", desc: "Optimized performance for the best user experience" },
          { title: "Secure by Default", desc: "Enterprise-grade security built into every layer" },
          { title: "Scale Easily", desc: "Grow from prototype to production without changes" },
        ],
      },
    });
  }

  if (lower.includes("about") || lower.includes("text") || lower.includes("content")) {
    blocks.push({
      id: nanoid(8),
      type: "heading",
      props: { text: "About Us", align: "center" },
    });
    blocks.push({
      id: nanoid(8),
      type: "text",
      props: {
        text: "We are a team of passionate builders dedicated to making web development accessible to everyone. Our platform empowers creators to build beautiful websites without any coding knowledge.",
        align: "center",
      },
    });
  }

  if (lower.includes("button") || lower.includes("cta") || lower.includes("action")) {
    blocks.push({
      id: nanoid(8),
      type: "button",
      props: { text: "Learn More", url: "#", align: "center" },
    });
  }

  if (lower.includes("section") || lower.includes("container")) {
    blocks.push({
      id: nanoid(8),
      type: "section",
      props: { title: "New Section" },
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      id: nanoid(8),
      type: "hero",
      props: {
        title: "Your Amazing Website",
        subtitle: prompt,
        buttonText: "Explore",
      },
    });
    blocks.push({
      id: nanoid(8),
      type: "text",
      props: {
        text: "This content was generated based on your prompt. You can edit it using the properties panel or ask AI to regenerate.",
        align: "left",
      },
    });
  }

  return blocks;
}

function generateStaticSite(name: string, schema: any[]): { html: string; css: string } {
  let bodyHtml = "";

  for (const block of schema) {
    const props = block.props || {};
    switch (block.type) {
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
        bodyHtml += `<div style="text-align:${props.align || "left"}"><a href="${escHtml(props.url || "#")}" class="btn">${escHtml(props.text || "Button")}</a></div>\n`;
        break;
      case "image":
        bodyHtml += `<div class="image-block"><img src="${escHtml(props.src || "")}" alt="${escHtml(props.alt || "")}" style="height:${props.height || "200px"};width:100%;object-fit:cover;" /></div>\n`;
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
      case "features":
        const features = props.features || [];
        bodyHtml += `<div class="features-grid">${features.map((f: any) => `<div class="feature-card"><h4>${escHtml(f.title || "")}</h4><p>${escHtml(f.desc || "")}</p></div>`).join("")}</div>\n`;
        break;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(name)}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
${bodyHtml}
</body>
</html>`;

  const css = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; }
.hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 80px 40px; text-align: center; }
.hero h1 { font-size: 2.5rem; margin-bottom: 16px; }
.hero p { font-size: 1.1rem; opacity: 0.9; max-width: 600px; margin: 0 auto 24px; }
.btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; }
.btn:hover { background: #2563eb; }
.heading { font-size: 1.75rem; padding: 20px 40px; }
.text-block { padding: 10px 40px; color: #4a4a4a; max-width: 800px; }
.image-block { padding: 20px 40px; }
.image-block img { border-radius: 8px; }
.divider { border: none; border-top: 1px solid #e5e5e5; margin: 20px 40px; }
.content-section { padding: 40px; background: #f8f8f8; }
.features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; padding: 40px; }
.feature-card { background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px; }
.feature-card h4 { margin-bottom: 8px; }
.feature-card p { color: #666; font-size: 0.9rem; }`;

  return { html, css };
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
