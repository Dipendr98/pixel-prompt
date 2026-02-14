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

      const project = await storage.getProject(req.params.projectId as string, userId);
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

function generateMockBlocks(prompt: string): any[] {
  const lower = prompt.toLowerCase();
  const blocks: any[] = [];

  const isEcommerce = lower.includes("ecommerce") || lower.includes("e-commerce") || lower.includes("store") || lower.includes("shop") || lower.includes("product");
  const isRestaurant = lower.includes("restaurant") || lower.includes("food") || lower.includes("cafe") || lower.includes("menu") || lower.includes("dining");
  const isPortfolio = lower.includes("portfolio") || lower.includes("freelance") || lower.includes("designer") || lower.includes("photographer");
  const isSaas = lower.includes("saas") || lower.includes("software") || lower.includes("app") || lower.includes("startup") || lower.includes("platform");
  const isBlog = lower.includes("blog") || lower.includes("article") || lower.includes("news") || lower.includes("magazine");
  const isLanding = lower.includes("landing") || lower.includes("launch") || lower.includes("coming soon") || lower.includes("waitlist");
  const isAgency = lower.includes("agency") || lower.includes("marketing") || lower.includes("consulting") || lower.includes("service");
  const isRealEstate = lower.includes("real estate") || lower.includes("property") || lower.includes("housing") || lower.includes("apartment");
  const isFitness = lower.includes("gym") || lower.includes("fitness") || lower.includes("yoga") || lower.includes("health") || lower.includes("wellness");
  const isEducation = lower.includes("course") || lower.includes("education") || lower.includes("school") || lower.includes("learning") || lower.includes("academy");

  if (isEcommerce) {
    blocks.push(
      { id: nanoid(8), type: "navbar", props: { brand: "ShopHub", links: [{ label: "Home", url: "#" }, { label: "Products", url: "#products" }, { label: "Categories", url: "#categories" }, { label: "Sale", url: "#sale" }, { label: "Contact", url: "#contact" }], ctaText: "Cart (0)" } },
      { id: nanoid(8), type: "hero", props: { title: "Discover Amazing Products", subtitle: "Shop our curated collection of premium items. Free shipping on orders over $50.", buttonText: "Shop Now" } },
      { id: nanoid(8), type: "banner", props: { text: "FLASH SALE: Use code SAVE20 for 20% off everything!", linkText: "Shop the Sale", variant: "info" } },
      { id: nanoid(8), type: "heading", props: { text: "Featured Products", align: "center" } },
      { id: nanoid(8), type: "product-card", props: { products: [
        { name: "Wireless Headphones", price: "$79.99", description: "Premium noise-cancelling wireless headphones with 30hr battery", image: "" },
        { name: "Smart Watch Pro", price: "$199.99", description: "Track your fitness, calls, and notifications on the go", image: "" },
        { name: "Portable Speaker", price: "$49.99", description: "Waterproof Bluetooth speaker with 360-degree sound", image: "" },
      ] } },
      { id: nanoid(8), type: "features", props: { features: [
        { title: "Free Shipping", desc: "On all orders over $50" },
        { title: "Easy Returns", desc: "30-day money back guarantee" },
        { title: "Secure Payment", desc: "256-bit SSL encryption" },
      ] } },
      { id: nanoid(8), type: "testimonials", props: { testimonials: [
        { name: "Emma W.", role: "Verified Buyer", quote: "Amazing quality and fast shipping! Will definitely order again." },
        { name: "David L.", role: "Verified Buyer", quote: "Best online shopping experience. Customer service is top-notch." },
        { name: "Sarah M.", role: "Verified Buyer", quote: "Love the product! Exactly as described and arrived on time." },
      ] } },
      { id: nanoid(8), type: "newsletter", props: { title: "Join Our Newsletter", subtitle: "Get exclusive deals and 10% off your first order", buttonText: "Subscribe" } },
      { id: nanoid(8), type: "footer", props: { columns: [{ title: "Shop", links: ["New Arrivals", "Best Sellers", "Sale", "Gift Cards"] }, { title: "Help", links: ["Shipping Info", "Returns", "Size Guide", "Track Order"] }, { title: "Company", links: ["About Us", "Careers", "Press", "Blog"] }], copyright: "2025 ShopHub. All rights reserved." } }
    );
  } else if (isRestaurant) {
    blocks.push(
      { id: nanoid(8), type: "navbar", props: { brand: "Bella Cucina", links: [{ label: "Home", url: "#" }, { label: "Menu", url: "#menu" }, { label: "About", url: "#about" }, { label: "Gallery", url: "#gallery" }], ctaText: "Reserve Table" } },
      { id: nanoid(8), type: "hero", props: { title: "Authentic Italian Cuisine", subtitle: "Experience the finest handcrafted dishes made with fresh, locally-sourced ingredients. Dine in or order online.", buttonText: "View Menu" } },
      { id: nanoid(8), type: "heading", props: { text: "Our Signature Dishes", align: "center" } },
      { id: nanoid(8), type: "product-card", props: { products: [
        { name: "Truffle Risotto", price: "$28", description: "Arborio rice with wild mushrooms and black truffle", image: "" },
        { name: "Grilled Sea Bass", price: "$34", description: "Fresh catch with lemon butter and capers", image: "" },
        { name: "Tiramisu", price: "$14", description: "Classic Italian dessert with espresso and mascarpone", image: "" },
      ] } },
      { id: nanoid(8), type: "stats", props: { stats: [{ value: "15+", label: "Years of Experience" }, { value: "200+", label: "Menu Items" }, { value: "50K+", label: "Happy Diners" }, { value: "4.9", label: "Star Rating" }] } },
      { id: nanoid(8), type: "gallery", props: { count: 6 } },
      { id: nanoid(8), type: "testimonials", props: { testimonials: [
        { name: "Michael B.", role: "Food Critic", quote: "One of the finest Italian restaurants in the city. Every dish is a masterpiece." },
        { name: "Jennifer L.", role: "Regular Guest", quote: "The ambiance and food quality are consistently excellent. Our go-to date night spot." },
        { name: "Robert K.", role: "Chef", quote: "The passion for authentic flavors shines through in every plate." },
      ] } },
      { id: nanoid(8), type: "contact-form", props: { title: "Make a Reservation", subtitle: "Call us or fill out the form below", buttonText: "Reserve Now" } },
      { id: nanoid(8), type: "footer", props: { columns: [{ title: "Hours", links: ["Mon-Thu: 11am-10pm", "Fri-Sat: 11am-11pm", "Sunday: 12pm-9pm"] }, { title: "Contact", links: ["(555) 123-4567", "info@bellacucina.com", "123 Main Street"] }, { title: "Follow Us", links: ["Instagram", "Facebook", "TripAdvisor"] }], copyright: "2025 Bella Cucina. All rights reserved." } }
    );
  } else if (isPortfolio) {
    blocks.push(
      { id: nanoid(8), type: "navbar", props: { brand: "Alex Design", links: [{ label: "Work", url: "#work" }, { label: "About", url: "#about" }, { label: "Services", url: "#services" }, { label: "Contact", url: "#contact" }], ctaText: "Hire Me" } },
      { id: nanoid(8), type: "hero", props: { title: "Creative Designer & Developer", subtitle: "I craft beautiful digital experiences that connect brands with their audience. Let's bring your vision to life.", buttonText: "View My Work" } },
      { id: nanoid(8), type: "logo-cloud", props: { title: "Trusted by amazing brands", logos: ["Google", "Spotify", "Netflix", "Airbnb", "Stripe"] } },
      { id: nanoid(8), type: "heading", props: { text: "Featured Projects", align: "center" } },
      { id: nanoid(8), type: "gallery", props: { count: 6 } },
      { id: nanoid(8), type: "features", props: { features: [
        { title: "UI/UX Design", desc: "Beautiful, intuitive interfaces that delight users" },
        { title: "Web Development", desc: "Fast, responsive websites built with modern tech" },
        { title: "Brand Identity", desc: "Logos, colors, and guidelines that define your brand" },
      ] } },
      { id: nanoid(8), type: "stats", props: { stats: [{ value: "100+", label: "Projects Completed" }, { value: "50+", label: "Happy Clients" }, { value: "8+", label: "Years Experience" }, { value: "15", label: "Awards Won" }] } },
      { id: nanoid(8), type: "testimonials", props: { testimonials: [
        { name: "Mark Z.", role: "Startup Founder", quote: "Exceeded our expectations. The redesign increased conversions by 40%." },
        { name: "Anna P.", role: "Marketing Director", quote: "An incredible eye for detail and a joy to work with." },
        { name: "Tom H.", role: "Product Manager", quote: "Delivered on time, on budget, and above quality standards." },
      ] } },
      { id: nanoid(8), type: "cta", props: { title: "Let's Work Together", subtitle: "Have a project in mind? I'd love to hear about it.", primaryButton: "Get in Touch", secondaryButton: "View Resume" } },
      { id: nanoid(8), type: "social-links", props: { links: [{ platform: "Dribbble", url: "#" }, { platform: "Behance", url: "#" }, { platform: "GitHub", url: "#" }, { platform: "LinkedIn", url: "#" }, { platform: "Twitter", url: "#" }] } }
    );
  } else if (isSaas) {
    blocks.push(
      { id: nanoid(8), type: "navbar", props: { brand: "CloudApp", links: [{ label: "Features", url: "#features" }, { label: "Pricing", url: "#pricing" }, { label: "Docs", url: "#docs" }, { label: "Blog", url: "#blog" }], ctaText: "Start Free Trial" } },
      { id: nanoid(8), type: "hero", props: { title: "The Smarter Way to Build Products", subtitle: "Streamline your workflow, collaborate in real-time, and ship faster with our all-in-one platform.", buttonText: "Start Free Trial" } },
      { id: nanoid(8), type: "logo-cloud", props: { title: "Powering teams at leading companies", logos: ["Slack", "Notion", "Figma", "Linear", "Vercel", "Stripe"] } },
      { id: nanoid(8), type: "features", props: { features: [
        { title: "Real-time Collaboration", desc: "Work together seamlessly with your team, no matter where they are" },
        { title: "Powerful Analytics", desc: "Get deep insights into your product performance and user behavior" },
        { title: "Enterprise Security", desc: "SOC 2 compliant with end-to-end encryption and SSO" },
      ] } },
      { id: nanoid(8), type: "stats", props: { stats: [{ value: "10K+", label: "Companies" }, { value: "99.9%", label: "Uptime" }, { value: "50M+", label: "API Calls/Day" }, { value: "150+", label: "Countries" }] } },
      { id: nanoid(8), type: "pricing-table", props: { plans: [
        { name: "Starter", price: "$0/mo", features: ["Up to 5 users", "Basic analytics", "Community support", "1 project"], highlighted: false },
        { name: "Pro", price: "$29/mo", features: ["Unlimited users", "Advanced analytics", "Priority support", "Unlimited projects", "API access"], highlighted: true },
        { name: "Enterprise", price: "Custom", features: ["Everything in Pro", "Dedicated success manager", "Custom SLA", "SSO & SAML", "On-premise option"], highlighted: false },
      ] } },
      { id: nanoid(8), type: "testimonials", props: { testimonials: [
        { name: "Katie M.", role: "VP Engineering, TechCo", quote: "CloudApp cut our development cycle by 60%. It's now essential to our workflow." },
        { name: "Ryan J.", role: "CTO, StartupX", quote: "The best developer tool we've adopted this year. Our team loves it." },
        { name: "Laura S.", role: "Product Lead, ScaleUp", quote: "Finally, a platform that actually delivers on its promises." },
      ] } },
      { id: nanoid(8), type: "faq", props: { title: "Frequently Asked Questions", items: [
        { question: "Can I try it for free?", answer: "Yes! Our Starter plan is completely free, no credit card required." },
        { question: "How does billing work?", answer: "We bill monthly or annually (save 20%). Cancel anytime." },
        { question: "Is my data secure?", answer: "Absolutely. We're SOC 2 Type II compliant with 256-bit encryption." },
      ] } },
      { id: nanoid(8), type: "cta", props: { title: "Ready to Transform Your Workflow?", subtitle: "Join 10,000+ teams already using CloudApp", primaryButton: "Start Free Trial", secondaryButton: "Talk to Sales" } },
      { id: nanoid(8), type: "footer", props: { columns: [{ title: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap"] }, { title: "Resources", links: ["Documentation", "API Reference", "Community", "Blog"] }, { title: "Company", links: ["About", "Careers", "Press", "Contact"] }], copyright: "2025 CloudApp Inc. All rights reserved." } }
    );
  } else if (isLanding) {
    blocks.push(
      { id: nanoid(8), type: "navbar", props: { brand: "LaunchPad", links: [{ label: "Features", url: "#" }, { label: "About", url: "#" }], ctaText: "Join Waitlist" } },
      { id: nanoid(8), type: "hero", props: { title: "Something Amazing is Coming", subtitle: "Be the first to experience our revolutionary new product. Join the waitlist today.", buttonText: "Get Early Access" } },
      { id: nanoid(8), type: "countdown", props: { title: "Launching Soon", subtitle: "Mark your calendars - something big is coming", targetDate: "" } },
      { id: nanoid(8), type: "features", props: { features: [
        { title: "Game Changing", desc: "A completely new approach to solving old problems" },
        { title: "Easy to Use", desc: "Intuitive design that anyone can master in minutes" },
        { title: "Built for Scale", desc: "Enterprise-ready infrastructure from day one" },
      ] } },
      { id: nanoid(8), type: "newsletter", props: { title: "Join the Waitlist", subtitle: "Get notified when we launch and receive exclusive early access", buttonText: "Notify Me" } },
      { id: nanoid(8), type: "social-links", props: { links: [{ platform: "Twitter", url: "#" }, { platform: "Instagram", url: "#" }, { platform: "LinkedIn", url: "#" }] } }
    );
  } else if (isAgency) {
    blocks.push(
      { id: nanoid(8), type: "navbar", props: { brand: "Catalyst Agency", links: [{ label: "Services", url: "#" }, { label: "Work", url: "#" }, { label: "Team", url: "#" }, { label: "Blog", url: "#" }], ctaText: "Get a Quote" } },
      { id: nanoid(8), type: "hero", props: { title: "We Build Brands That Matter", subtitle: "Full-service digital agency specializing in strategy, design, and growth marketing.", buttonText: "View Our Work" } },
      { id: nanoid(8), type: "features", props: { features: [
        { title: "Brand Strategy", desc: "Data-driven brand positioning that resonates with your audience" },
        { title: "Digital Marketing", desc: "SEO, PPC, and content marketing that drives real results" },
        { title: "Web Development", desc: "Custom websites and apps built for performance" },
      ] } },
      { id: nanoid(8), type: "stats", props: { stats: [{ value: "200+", label: "Projects Delivered" }, { value: "98%", label: "Client Retention" }, { value: "5x", label: "Average ROI" }, { value: "12", label: "Team Members" }] } },
      { id: nanoid(8), type: "team", props: { members: [
        { name: "Alex Rivera", role: "Creative Director", bio: "15 years of brand strategy" },
        { name: "Jordan Lee", role: "Lead Developer", bio: "Full-stack engineering expert" },
        { name: "Maya Chen", role: "Marketing Head", bio: "Growth & performance specialist" },
        { name: "Chris Park", role: "UX Designer", bio: "Human-centered design advocate" },
      ] } },
      { id: nanoid(8), type: "logo-cloud", props: { title: "Brands we've worked with", logos: ["Nike", "Apple", "Google", "Amazon", "Microsoft"] } },
      { id: nanoid(8), type: "testimonials", props: { testimonials: [
        { name: "James R.", role: "CEO, TechStart", quote: "Catalyst transformed our brand. Revenue increased 300% in 6 months." },
        { name: "Maria S.", role: "CMO, FinCorp", quote: "The most strategic and results-driven agency we've ever worked with." },
        { name: "David K.", role: "Founder, GreenCo", quote: "They don't just deliver projects, they deliver growth." },
      ] } },
      { id: nanoid(8), type: "contact-form", props: { title: "Start Your Project", subtitle: "Tell us about your goals and we'll craft a custom strategy", buttonText: "Submit Inquiry" } },
      { id: nanoid(8), type: "footer", props: { columns: [{ title: "Services", links: ["Branding", "Web Design", "SEO", "Content"] }, { title: "Company", links: ["About", "Team", "Careers", "Blog"] }, { title: "Contact", links: ["hello@catalyst.com", "(555) 987-6543", "NYC, New York"] }], copyright: "2025 Catalyst Agency. All rights reserved." } }
    );
  } else if (isRealEstate || isFitness || isEducation) {
    const niche = isRealEstate ? "real estate" : isFitness ? "fitness" : "education";
    const brand = isRealEstate ? "PrimeHomes" : isFitness ? "FitLife Studio" : "LearnHub Academy";
    blocks.push(
      { id: nanoid(8), type: "navbar", props: { brand, links: [{ label: "Home", url: "#" }, { label: "Services", url: "#" }, { label: "About", url: "#" }, { label: "Contact", url: "#" }], ctaText: isRealEstate ? "List Property" : isFitness ? "Join Now" : "Enroll" } },
      { id: nanoid(8), type: "hero", props: { title: isRealEstate ? "Find Your Dream Home" : isFitness ? "Transform Your Body & Mind" : "Learn Without Limits", subtitle: isRealEstate ? "Browse thousands of properties and find the perfect home for you and your family." : isFitness ? "Join our community and achieve your fitness goals with expert-led classes and personalized training." : "Access world-class courses from industry experts. Learn at your own pace, anywhere.", buttonText: isRealEstate ? "Browse Properties" : isFitness ? "Start Free Trial" : "Explore Courses" } },
      { id: nanoid(8), type: "features", props: { features: isRealEstate ? [{ title: "Verified Listings", desc: "All properties are verified by our team" }, { title: "Virtual Tours", desc: "Explore homes from the comfort of yours" }, { title: "Expert Agents", desc: "Connect with top local real estate agents" }] : isFitness ? [{ title: "Personal Training", desc: "One-on-one sessions with certified trainers" }, { title: "Group Classes", desc: "Yoga, HIIT, spin, and 20+ class types" }, { title: "Nutrition Plans", desc: "Custom meal plans for your goals" }] : [{ title: "Expert Instructors", desc: "Learn from industry professionals" }, { title: "Flexible Learning", desc: "Study at your own pace, on any device" }, { title: "Certificates", desc: "Earn recognized certificates upon completion" }] } },
      { id: nanoid(8), type: "stats", props: { stats: isRealEstate ? [{ value: "5000+", label: "Listings" }, { value: "2000+", label: "Homes Sold" }, { value: "500+", label: "Agents" }, { value: "4.8", label: "Rating" }] : isFitness ? [{ value: "500+", label: "Members" }, { value: "50+", label: "Classes/Week" }, { value: "20+", label: "Trainers" }, { value: "4.9", label: "Rating" }] : [{ value: "1000+", label: "Courses" }, { value: "50K+", label: "Students" }, { value: "200+", label: "Instructors" }, { value: "95%", label: "Completion Rate" }] } },
      { id: nanoid(8), type: "testimonials", props: { testimonials: [{ name: "Alex T.", role: "Happy Client", quote: `Best ${niche} experience I've ever had. Highly recommend!` }, { name: "Pat M.", role: "Client", quote: `Professional, reliable, and truly exceptional ${niche} service.` }, { name: "Sam R.", role: "Long-time Member", quote: `Changed my life. I can't imagine going anywhere else for ${niche}.` }] } },
      { id: nanoid(8), type: isRealEstate ? "pricing-table" : "pricing-table", props: { plans: [{ name: "Basic", price: isRealEstate ? "$0/mo" : isFitness ? "$29/mo" : "$9/mo", features: ["Basic Access", "Limited Features", "Email Support"], highlighted: false }, { name: "Premium", price: isRealEstate ? "$49/mo" : isFitness ? "$59/mo" : "$29/mo", features: ["Full Access", "All Features", "Priority Support", "Exclusive Content"], highlighted: true }, { name: "VIP", price: isRealEstate ? "$149/mo" : isFitness ? "$99/mo" : "$79/mo", features: ["Everything in Premium", "Personal Consultant", "Custom Solutions", "API Access"], highlighted: false }] } },
      { id: nanoid(8), type: "contact-form", props: { title: "Contact Us", subtitle: `Have questions about our ${niche} services? Reach out!`, buttonText: "Send Message" } },
      { id: nanoid(8), type: "footer", props: { columns: [{ title: "Services", links: ["Browse All", "Premium", "Enterprise"] }, { title: "Support", links: ["Help Center", "FAQ", "Contact"] }, { title: "Legal", links: ["Privacy", "Terms", "Cookies"] }], copyright: `2025 ${brand}. All rights reserved.` } }
    );
  } else {
    if (lower.includes("hero") || lower.includes("welcome")) {
      blocks.push({ id: nanoid(8), type: "hero", props: { title: "Welcome to Our Platform", subtitle: "Build something extraordinary with our powerful tools and intuitive interface.", buttonText: "Get Started Today" } });
    }
    if (lower.includes("navbar") || lower.includes("navigation") || lower.includes("header") || lower.includes("menu")) {
      blocks.push({ id: nanoid(8), type: "navbar", props: { brand: "MyBrand", links: [{ label: "Home", url: "#" }, { label: "About", url: "#" }, { label: "Services", url: "#" }, { label: "Contact", url: "#" }], ctaText: "Get Started" } });
    }
    if (lower.includes("product") || lower.includes("shop") || lower.includes("catalog")) {
      blocks.push({ id: nanoid(8), type: "product-card", props: { products: [{ name: "Product A", price: "$29.99", description: "High quality product", image: "" }, { name: "Product B", price: "$49.99", description: "Premium edition", image: "" }, { name: "Product C", price: "$19.99", description: "Budget friendly", image: "" }] } });
    }
    if (lower.includes("pricing") || lower.includes("plan")) {
      blocks.push({ id: nanoid(8), type: "pricing-table", props: { plans: [{ name: "Free", price: "$0", features: ["Basic features", "Community support"], highlighted: false }, { name: "Pro", price: "$29/mo", features: ["All features", "Priority support", "API access"], highlighted: true }, { name: "Enterprise", price: "Custom", features: ["Everything in Pro", "Dedicated support", "SLA"], highlighted: false }] } });
    }
    if (lower.includes("feature") || lower.includes("service") || lower.includes("benefit")) {
      blocks.push({ id: nanoid(8), type: "features", props: { features: [{ title: "Lightning Fast", desc: "Optimized performance for the best experience" }, { title: "Secure by Default", desc: "Enterprise-grade security built into every layer" }, { title: "Scale Easily", desc: "Grow from prototype to production effortlessly" }] } });
    }
    if (lower.includes("testimonial") || lower.includes("review") || lower.includes("customer")) {
      blocks.push({ id: nanoid(8), type: "testimonials", props: { testimonials: [{ name: "Sarah J.", role: "CEO", quote: "Absolutely transformed our business!" }, { name: "Mike R.", role: "CTO", quote: "Best tool we've adopted this year." }, { name: "Lisa K.", role: "Designer", quote: "Incredible quality and attention to detail." }] } });
    }
    if (lower.includes("faq") || lower.includes("question") || lower.includes("answer")) {
      blocks.push({ id: nanoid(8), type: "faq", props: { title: "Frequently Asked Questions", items: [{ question: "How does it work?", answer: "Simply sign up and get started in minutes." }, { question: "What's included?", answer: "Full access to all features and support." }, { question: "Can I cancel anytime?", answer: "Yes, no lock-in contracts." }] } });
    }
    if (lower.includes("contact") || lower.includes("form") || lower.includes("reach") || lower.includes("message")) {
      blocks.push({ id: nanoid(8), type: "contact-form", props: { title: "Contact Us", subtitle: "We'd love to hear from you", buttonText: "Send Message" } });
    }
    if (lower.includes("team") || lower.includes("people") || lower.includes("staff")) {
      blocks.push({ id: nanoid(8), type: "team", props: { members: [{ name: "John Doe", role: "CEO", bio: "Visionary leader" }, { name: "Jane Smith", role: "CTO", bio: "Tech innovator" }, { name: "Alex Chen", role: "Designer", bio: "Creative mind" }, { name: "Sam Wilson", role: "Marketing", bio: "Growth expert" }] } });
    }
    if (lower.includes("stats") || lower.includes("number") || lower.includes("counter") || lower.includes("metric")) {
      blocks.push({ id: nanoid(8), type: "stats", props: { stats: [{ value: "10K+", label: "Users" }, { value: "99.9%", label: "Uptime" }, { value: "50+", label: "Countries" }, { value: "24/7", label: "Support" }] } });
    }
    if (lower.includes("gallery") || lower.includes("photo") || lower.includes("image")) {
      blocks.push({ id: nanoid(8), type: "gallery", props: { count: 8 } });
    }
    if (lower.includes("video")) {
      blocks.push({ id: nanoid(8), type: "video", props: { url: "", height: "300px" } });
    }
    if (lower.includes("newsletter") || lower.includes("subscribe") || lower.includes("email signup")) {
      blocks.push({ id: nanoid(8), type: "newsletter", props: { title: "Stay Updated", subtitle: "Subscribe to our newsletter", buttonText: "Subscribe" } });
    }
    if (lower.includes("banner") || lower.includes("announcement")) {
      blocks.push({ id: nanoid(8), type: "banner", props: { text: "Important announcement here!", variant: "info" } });
    }
    if (lower.includes("countdown") || lower.includes("timer") || lower.includes("launch")) {
      blocks.push({ id: nanoid(8), type: "countdown", props: { title: "Coming Soon", subtitle: "Stay tuned for something amazing" } });
    }
    if (lower.includes("cta") || lower.includes("call to action") || lower.includes("action")) {
      blocks.push({ id: nanoid(8), type: "cta", props: { title: "Ready to Get Started?", subtitle: "Join thousands of satisfied customers", primaryButton: "Get Started", secondaryButton: "Learn More" } });
    }
    if (lower.includes("footer") || lower.includes("bottom")) {
      blocks.push({ id: nanoid(8), type: "footer", props: { columns: [{ title: "Company", links: ["About", "Blog", "Careers"] }, { title: "Support", links: ["Help", "Contact", "FAQ"] }, { title: "Legal", links: ["Privacy", "Terms"] }], copyright: "2025 Your Company. All rights reserved." } });
    }
    if (lower.includes("social") || lower.includes("follow")) {
      blocks.push({ id: nanoid(8), type: "social-links", props: { links: [{ platform: "Twitter", url: "#" }, { platform: "Facebook", url: "#" }, { platform: "Instagram", url: "#" }, { platform: "LinkedIn", url: "#" }] } });
    }
    if (lower.includes("logo") || lower.includes("partner") || lower.includes("client") || lower.includes("trust")) {
      blocks.push({ id: nanoid(8), type: "logo-cloud", props: { title: "Trusted by industry leaders", logos: ["Google", "Microsoft", "Amazon", "Apple", "Meta"] } });
    }
    if (lower.includes("about") || lower.includes("text") || lower.includes("content") || lower.includes("paragraph")) {
      blocks.push({ id: nanoid(8), type: "heading", props: { text: "About Us", align: "center" } });
      blocks.push({ id: nanoid(8), type: "text", props: { text: "We are a team of passionate builders dedicated to making web development accessible to everyone. Our platform empowers creators to build beautiful websites without any coding knowledge.", align: "center" } });
    }
    if (lower.includes("button")) {
      blocks.push({ id: nanoid(8), type: "button", props: { text: "Learn More", url: "#", align: "center" } });
    }
  }

  if (blocks.length === 0) {
    blocks.push(
      { id: nanoid(8), type: "hero", props: { title: "Your Amazing Website", subtitle: prompt, buttonText: "Explore" } },
      { id: nanoid(8), type: "features", props: { features: [{ title: "Feature 1", desc: "Description of feature one" }, { title: "Feature 2", desc: "Description of feature two" }, { title: "Feature 3", desc: "Description of feature three" }] } },
      { id: nanoid(8), type: "cta", props: { title: "Get Started Today", subtitle: "Transform your business with our solution", primaryButton: "Start Now", secondaryButton: "Learn More" } }
    );
  }

  return blocks;
}

function generateStaticSite(name: string, schema: any[]): { html: string; css: string } {
  let bodyHtml = "";

  for (const block of schema) {
    const props = block.props || {};
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
a { color: inherit; text-decoration: none; }
img { max-width: 100%; height: auto; }

/* Navbar */
.navbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 40px; border-bottom: 1px solid #e5e5e5; position: sticky; top: 0; background: white; z-index: 100; }
.nav-brand { font-weight: 700; font-size: 1.25rem; }
.nav-links { display: flex; align-items: center; gap: 24px; }
.nav-links a { font-size: 0.9rem; color: #555; transition: color 0.2s; }
.nav-links a:hover { color: #1a1a1a; }

/* Hero */
.hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 80px 40px; text-align: center; }
.hero h1 { font-size: 2.5rem; margin-bottom: 16px; max-width: 700px; margin-left: auto; margin-right: auto; }
.hero p { font-size: 1.1rem; opacity: 0.9; max-width: 600px; margin: 0 auto 24px; }

/* Buttons */
.btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; border: none; cursor: pointer; font-size: 0.95rem; transition: background 0.2s; }
.btn:hover { background: #2563eb; }
.btn-sm { padding: 8px 16px; font-size: 0.85rem; }
.btn-outline { background: transparent; border: 2px solid #3b82f6; color: #3b82f6; }
.btn-outline:hover { background: #3b82f6; color: white; }

/* Content */
.heading { font-size: 1.75rem; padding: 20px 40px; }
.text-block { padding: 10px 40px; color: #4a4a4a; max-width: 800px; }
.button-wrap { padding: 10px 40px; }
.image-block { padding: 20px 40px; }
.image-block img { border-radius: 8px; }
.divider { border: none; border-top: 1px solid #e5e5e5; margin: 20px 40px; }
.content-section { padding: 40px; background: #f8f8f8; }

/* Features */
.features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; padding: 40px; }
.feature-card { background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px; }
.feature-card h4 { margin-bottom: 8px; color: #1a1a1a; }
.feature-card p { color: #666; font-size: 0.9rem; }

/* Products */
.products-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; padding: 40px; }
.product-card { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; background: white; }
.product-img img { width: 100%; height: 200px; object-fit: cover; }
.product-info { padding: 16px; }
.product-info h4 { margin-bottom: 4px; }
.product-info p { color: #666; font-size: 0.85rem; margin-bottom: 12px; }
.product-footer { display: flex; align-items: center; justify-content: space-between; }
.price { font-weight: 700; color: #3b82f6; font-size: 1.1rem; }

/* Pricing */
.pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; padding: 40px; }
.pricing-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 32px; text-align: center; background: white; }
.pricing-card.highlighted { border-color: #3b82f6; box-shadow: 0 0 0 2px #3b82f6; }
.plan-name { text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem; color: #888; margin-bottom: 8px; }
.plan-price { font-size: 2rem; font-weight: 700; margin-bottom: 16px; }
.plan-features { list-style: none; text-align: left; margin-bottom: 24px; }
.plan-features li { padding: 6px 0; font-size: 0.9rem; color: #555; border-bottom: 1px solid #f3f4f6; }
.plan-features li::before { content: "\\2713 "; color: #3b82f6; font-weight: 700; margin-right: 8px; }

/* Contact Form */
.contact-form-wrap { max-width: 500px; margin: 0 auto; padding: 40px; }
.contact-form-wrap h3 { font-size: 1.5rem; margin-bottom: 4px; }
.contact-form-wrap .subtitle { color: #666; margin-bottom: 24px; font-size: 0.9rem; }
.contact-form { display: flex; flex-direction: column; gap: 12px; }
.contact-form input, .contact-form textarea { padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; font-family: inherit; }
.contact-form input:focus, .contact-form textarea:focus { outline: none; border-color: #3b82f6; }

/* Testimonials */
.testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; padding: 40px; }
.testimonial-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px; background: white; }
.testimonial-card blockquote { font-style: italic; color: #555; margin-bottom: 16px; font-size: 0.95rem; }
.testimonial-author strong { display: block; }
.testimonial-author span { font-size: 0.85rem; color: #888; }

/* Gallery */
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; padding: 20px 40px; }
.gallery-item img { width: 100%; height: 200px; object-fit: cover; border-radius: 6px; }

/* Video */
.video-embed { padding: 20px 40px; }
.video-embed iframe { border-radius: 8px; }

/* FAQ */
.faq-section { max-width: 700px; margin: 0 auto; padding: 40px; }
.faq-section h3 { text-align: center; margin-bottom: 24px; font-size: 1.5rem; }
.faq-item { border: 1px solid #e5e5e5; border-radius: 6px; margin-bottom: 8px; }
.faq-item summary { padding: 14px 16px; font-weight: 500; cursor: pointer; font-size: 0.95rem; }
.faq-item p { padding: 0 16px 14px; color: #666; font-size: 0.9rem; }

/* Stats */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 24px; padding: 40px; text-align: center; }
.stat-value { font-size: 2rem; font-weight: 700; color: #3b82f6; }
.stat-label { font-size: 0.85rem; color: #888; margin-top: 4px; }

/* Team */
.team-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; padding: 40px; text-align: center; }
.team-avatar { width: 60px; height: 60px; border-radius: 50%; background: #e0e7ff; color: #3b82f6; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 1.25rem; font-weight: 700; }
.team-card h4 { margin-bottom: 2px; }
.team-role { color: #3b82f6; font-size: 0.85rem; }
.team-card p { color: #666; font-size: 0.85rem; margin-top: 8px; }

/* Social Links */
.social-links { display: flex; justify-content: center; gap: 12px; padding: 20px 40px; }
.social-link { width: 40px; height: 40px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 0; color: #555; transition: background 0.2s; }
.social-link::after { content: attr(href); font-size: 0; }
.social-link:hover { background: #3b82f6; color: white; }

/* Banner */
.banner { padding: 12px 40px; text-align: center; font-size: 0.9rem; }
.banner-info { background: #eff6ff; color: #1e40af; }
.banner-warning { background: #fefce8; color: #854d0e; }
.banner-error { background: #fef2f2; color: #991b1b; }
.banner a { font-weight: 600; text-decoration: underline; margin-left: 8px; }

/* Countdown */
.countdown-section { text-align: center; padding: 40px; }
.countdown-section h3 { font-size: 1.5rem; margin-bottom: 24px; }
.countdown-timer { display: flex; justify-content: center; gap: 16px; margin-bottom: 16px; }
.countdown-unit { background: #f3f4f6; border-radius: 8px; padding: 16px; min-width: 70px; }
.countdown-unit span { font-size: 1.5rem; font-weight: 700; display: block; }
.countdown-unit small { font-size: 0.75rem; color: #888; }
.countdown-section p { color: #666; font-size: 0.9rem; }

/* Newsletter */
.newsletter-section { text-align: center; padding: 40px; background: #f8f9ff; }
.newsletter-section h3 { font-size: 1.5rem; margin-bottom: 8px; }
.newsletter-section p { color: #666; margin-bottom: 20px; }
.newsletter-form { display: flex; gap: 8px; max-width: 400px; margin: 0 auto; }
.newsletter-form input { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; }

/* Logo Cloud */
.logo-cloud { text-align: center; padding: 30px 40px; }
.logo-title { font-size: 0.85rem; color: #888; margin-bottom: 16px; }
.logo-grid { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; }
.logo-item { background: #f3f4f6; padding: 10px 20px; border-radius: 6px; font-weight: 500; color: #888; font-size: 0.85rem; }

/* CTA */
.cta-section { text-align: center; padding: 60px 40px; background: linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%); }
.cta-section h3 { font-size: 1.75rem; margin-bottom: 8px; }
.cta-section p { color: #555; margin-bottom: 24px; }
.cta-buttons { display: flex; justify-content: center; gap: 12px; }

/* Footer */
.site-footer { background: #1a1a1a; color: #ccc; padding: 40px; }
.footer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 32px; margin-bottom: 24px; }
.footer-col h4 { color: white; margin-bottom: 12px; font-size: 0.9rem; }
.footer-col a { display: block; color: #999; font-size: 0.85rem; padding: 3px 0; transition: color 0.2s; }
.footer-col a:hover { color: white; }
.footer-bottom { border-top: 1px solid #333; padding-top: 16px; text-align: center; font-size: 0.8rem; color: #888; }

/* Responsive */
@media (max-width: 768px) {
  .navbar { flex-direction: column; gap: 12px; }
  .hero { padding: 50px 20px; }
  .hero h1 { font-size: 1.75rem; }
  .features-grid, .products-grid, .pricing-grid, .testimonials-grid, .team-grid, .stats-grid { grid-template-columns: 1fr; padding: 20px; }
  .heading, .text-block, .button-wrap, .image-block { padding-left: 20px; padding-right: 20px; }
}`;

  return { html, css };
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
