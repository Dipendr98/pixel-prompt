/**
 * Multi-Agent Orchestrator — PixelPrompt
 *
 * Pipeline: Discover → Plan → Code → Review
 *
 * Intelligence design:
 *   Phase 0 — DISCOVER: Chain-of-thought reasoning to deeply understand what the user
 *             truly needs. Thinks step-by-step: audience, goal, narrative, must-haves,
 *             implied needs, design psychology, content strategy.
 *
 *   Phase 1 — PLAN: Uses discovery to architect a perfect page flow. Chooses blocks
 *             that tell a story from top to bottom, not just random sections.
 *
 *   Phase 2 — CODE: Generates rich, specific, industry-aware content. No generic
 *             "Feature 1" — real content that fits the profession/business.
 *
 *   Phase 3 — REVIEW: Deep quality pass — coherence, contrast, animations, completeness.
 */

import { callWithFallback, callWithFallbackValidated } from "./providers.js";
import { nanoid } from "nanoid";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentTask {
  id: string;
  phase: "discover" | "plan" | "code" | "review";
  description: string;
  status: "pending" | "running" | "done" | "failed";
  providerName?: string;
  model?: string;
  result?: Record<string, unknown>;
  error?: string;
}

export interface DiscoveryResult {
  websiteType: "portfolio" | "ecommerce" | "saas" | "blog" | "restaurant" | "agency" | "landing" | "event" | "education" | "personal" | "other";
  subType: string;
  profession: string;
  targetAudience: string;
  primaryGoal: string;
  pageNarrative: string;
  keyFeatures: string[];
  impliedFeatures: string[];
  mustHaveBlocks: string[];
  designStyle: string;
  colorPsychology: string;
  contentTone: string;
  personalization: string;
  /** When the model follows extended discovery schema */
  pageRole?: string;
  pageScope?: string;
  /** Plain-language commitment: what the user wants built (filled in discovery, step before design) */
  whatUserWants?: string;
  /** Why the model interpreted the request that way */
  whyThisInterpretation?: string[];
}

export interface PlanResult {
  intent: string;
  style: string;
  blocks: string[];
  colorScheme: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
  };
}

export interface OrchestrationResult {
  blocks: ValidBlock[];
  plan: PlanResult;
  message: string;
  tasks: AgentTask[];
}

export type ProgressEvent =
  | { type: "phase_start"; phase: string; message: string }
  | { type: "phase_end"; phase: string; message: string; data?: unknown }
  | { type: "task_update"; task: AgentTask }
  | { type: "log"; message: string }
  | { type: "thinking"; phase: "intent" | "structure"; summary: string; bullets?: string[] }
  | { type: "error"; message: string; fatal?: boolean };

export type ProgressCallback = (event: ProgressEvent) => void;

export type ValidBlock = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  [key: string]: unknown;
};

// ── Valid block types ─────────────────────────────────────────────────────────

const VALID_TYPES = new Set([
  "hero", "navbar", "footer", "features", "testimonials", "pricing-table",
  "stats", "team", "gallery", "faq", "contact-form", "newsletter",
  "logo-cloud", "cta", "banner", "heading", "text", "button", "image",
  "divider", "spacer", "countdown", "product-card", "social-links", "video",
  "blog-post", "blog-list", "cart", "checkout-form", "map", "booking-form",
  "login-form", "section", "project-card", "experience-timeline", "skills-grid",
  "process-steps", "service-card", "menu-grid", "event-schedule", "course-card", "comparison-table",
]);

/** Builder/API context so the model knows this is a multi-page project, not a greenfield homepage. */
export type PageRole =
  | "home"
  | "about"
  | "contact"
  | "projects"
  | "services"
  | "pricing"
  | "blog"
  | "legal"
  | "landing"
  | "other";

export interface OrchestrationContext {
  /** Page currently selected in the builder UI */
  currentPageName?: string;
  /** Client-detected target (e.g. "About" from "create about page") */
  targetPageName?: string;
  /** Compact outline: page names + block types already on the site */
  siteSummary?: string;
}

function roleFromTargetPageName(name: string): PageRole | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (n === "about" || n.startsWith("about ")) return "about";
  if (n === "contact") return "contact";
  if (n === "projects" || n === "project" || n === "work") return "projects";
  if (n === "services" || n === "service") return "services";
  if (n === "pricing") return "pricing";
  if (n === "blog") return "blog";
  if (n === "privacy" || n === "terms" || n === "legal") return "legal";
  if (n === "home") return "home";
  return null;
}

function inferPageRole(
  prompt: string,
  targetPageName?: string,
  currentPageName?: string
): PageRole {
  const fromTarget = targetPageName ? roleFromTargetPageName(targetPageName) : null;
  if (fromTarget) return fromTarget;

  const p = prompt.toLowerCase();
  if (/(?:create|make|build|add|generate|design)\s+(?:an?\s+|the\s+)?about\s+page\b/.test(p)) return "about";
  if (/(?:create|make|build|add|generate|design)\s+(?:an?\s+|the\s+)?contact\s+page\b/.test(p)) return "contact";
  if (/(?:create|make|build|add|generate|design)\s+(?:an?\s+|the\s+)?(projects?|work)\s+page\b/.test(p)) return "projects";
  if (/(?:create|make|build|add|generate|design)\s+(?:an?\s+|the\s+)?services?\s+page\b/.test(p)) return "services";
  if (/(?:create|make|build|add|generate|design)\s+(?:an?\s+|the\s+)?pricing\s+page\b/.test(p)) return "pricing";
  if (/(?:create|make|build|add|generate|design)\s+(?:an?\s+|the\s+)?blog\s+page\b/.test(p)) return "blog";
  if (/\babout\s+page\b/.test(p) && /\bcontact\s+page\b/.test(p)) return "other";
  if (/\babout\s+page\b/.test(p)) return "about";
  if (/\bcontact\s+page\b/.test(p)) return "contact";
  if (/\bprojects?\s+page\b/.test(p) || /\bwork\s+page\b/.test(p)) return "projects";

  const cur = (currentPageName || "").trim().toLowerCase();
  if (cur && /\b(?:this|the)\s+page\b/.test(p)) {
    const r = roleFromTargetPageName(currentPageName || "");
    if (r) return r;
  }

  return "home";
}

function buildOrchestrationContextPrefix(ctx: OrchestrationContext | undefined, role: PageRole): string {
  const parts: string[] = ["<pixelprompt_builder_context>"];
  parts.push(`<inferred_page_role>${role}</inferred_page_role>`);
  if (ctx?.currentPageName) parts.push(`<current_page_in_editor>${ctx.currentPageName}</current_page_in_editor>`);
  if (ctx?.targetPageName) parts.push(`<user_target_page_name>${ctx.targetPageName}</user_target_page_name>`);
  if (ctx?.siteSummary) parts.push(`<existing_site_outline>${ctx.siteSummary}</existing_site_outline>`);

  if (role === "about") {
    parts.push(
      `<page_type_rules priority="critical">
THIS IS AN ABOUT PAGE — NOT A HOMEPAGE. Do NOT repeat the Home landing pattern (generic "Crafting solutions" dev hero + full skills-grid + project grid).
Use a personal headline (e.g. "About [Name]" or "My Story"), biography, values or journey, credibility (timeline/stats), optional testimonials, then a soft CTA. Reuse brand/colors from the site outline for consistency but change layout and copy completely.
</page_type_rules>`
    );
  } else if (role === "contact") {
    parts.push(
      `<page_type_rules priority="critical">
THIS IS A CONTACT PAGE. Prioritize contact-form, optional map, social-links, office hours or FAQ for scheduling. Minimal hero (page title + one line). Do NOT fill the page with project-card, skills-grid, or a second homepage hero.
</page_type_rules>`
    );
  } else if (role === "projects") {
    parts.push(
      `<page_type_rules priority="critical">
THIS IS A PROJECTS / WORK PAGE. Lead with project-card (case studies), optional stats, filter narrative — not a duplicate bio hero from Home.
</page_type_rules>`
    );
  } else if (role === "services") {
    parts.push(
      `<page_type_rules priority="critical">
THIS IS A SERVICES PAGE. Use service-card, features/process-steps, testimonials, pricing or CTA — not the same blocks order as Home unless user asks.
</page_type_rules>`
    );
  } else if (role === "pricing") {
    parts.push(
      `<page_type_rules priority="critical">
THIS IS A PRICING PAGE. Center pricing-table, comparison-table, FAQ — avoid portfolio hero clichés.
</page_type_rules>`
    );
  } else if (role === "legal") {
    parts.push(
      `<page_type_rules priority="critical">
THIS IS A LEGAL / POLICY PAGE. Use heading + text sections, minimal chrome, readable layout — not marketing sections.
</page_type_rules>`
    );
  }

  parts.push("</pixelprompt_builder_context>");
  return parts.join("\n");
}

function wrapUserPromptForAgents(original: string, ctx?: OrchestrationContext): string {
  const role = inferPageRole(original, ctx?.targetPageName, ctx?.currentPageName);
  const prefix = buildOrchestrationContextPrefix(ctx, role);
  return `${prefix}
<user_request>
${original}
</user_request>`;
}

/** When the model still returns a homepage-style discovery, force secondary-page structure. */
function adjustDiscoveryForPageRole(d: DiscoveryResult, role: PageRole): void {
  if (role === "home" || role === "landing" || role === "other") return;

  if (role === "about") {
    d.primaryGoal = "Help visitors understand the person/brand story and build trust";
    d.pageNarrative = "Who I am → Background & values → Credibility → Optional proof → Connect";
    d.mustHaveBlocks = [
      "navbar",
      "hero",
      "heading",
      "text",
      "features",
      "experience-timeline",
      "stats",
      "social-links",
      "footer",
    ];
  } else if (role === "contact") {
    d.primaryGoal = "Make it effortless to reach out or book time";
    d.pageNarrative = "Clear page intent → Contact options → Form → Location/links → Trust cues";
    d.mustHaveBlocks = ["navbar", "hero", "contact-form", "map", "social-links", "faq", "footer"];
  } else if (role === "projects") {
    d.primaryGoal = "Showcase work and outcomes";
    d.pageNarrative = "Context → Featured work → Metrics → Next step";
    d.mustHaveBlocks = ["navbar", "hero", "project-card", "stats", "cta", "footer"];
  } else if (role === "services") {
    d.primaryGoal = "Explain offerings and drive inquiries";
    d.pageNarrative = "Services overview → Detail cards → Process → Proof → Contact";
    d.mustHaveBlocks = ["navbar", "hero", "service-card", "process-steps", "testimonials", "cta", "contact-form", "footer"];
  } else if (role === "pricing") {
    d.primaryGoal = "Compare plans and convert";
    d.pageNarrative = "Value framing → Plans → Comparison → Objections (FAQ) → CTA";
    d.mustHaveBlocks = ["navbar", "hero", "pricing-table", "comparison-table", "faq", "cta", "footer"];
  } else if (role === "legal") {
    d.primaryGoal = "Deliver clear legal/policy text";
    d.pageNarrative = "Title → Sections of plain language";
    d.mustHaveBlocks = ["navbar", "heading", "text", "divider", "text", "footer"];
  }
}

function normalizeInterpretationBullets(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 6);
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

function synthesizeWhatUserWants(d: DiscoveryResult, role: PageRole): string {
  if (d.whatUserWants && typeof d.whatUserWants === "string" && d.whatUserWants.trim()) {
    return d.whatUserWants.trim();
  }
  const pageBit = role !== "home" && role !== "other" ? `${role} page for ` : "";
  return `${pageBit}a ${d.websiteType || "website"} for ${d.profession || "the described business or person"}, with primary goal: ${d.primaryGoal || "engage visitors effectively"}.`;
}

function synthesizeInterpretationBullets(d: DiscoveryResult): string[] {
  const fromModel = normalizeInterpretationBullets(d.whyThisInterpretation);
  if (fromModel.length > 0) return fromModel;
  const out: string[] = [];
  if (d.targetAudience) out.push(`Audience: ${d.targetAudience}`);
  if (d.pageNarrative) out.push(`Planned story: ${d.pageNarrative}`);
  if (d.impliedFeatures?.length) {
    out.push(`Implied needs addressed: ${d.impliedFeatures.slice(0, 4).join(", ")}`);
  }
  if (d.mustHaveBlocks?.length) {
    out.push(
      `Section focus: ${d.mustHaveBlocks.slice(0, 6).join(", ")}${d.mustHaveBlocks.length > 6 ? "…" : ""}`
    );
  }
  return out.slice(0, 5);
}

// ── PHASE 0: Discovery Prompt ─────────────────────────────────────────────────
// Forces the model to reason step-by-step through every dimension of the request.

const DISCOVERY_SYSTEM = `<role>
You are a world-class website strategist and digital consultant for PixelPrompt.
You think deeply before acting. You consider EVERY possibility about what the user is building,
who it is for, what will make it succeed, and what the user likely forgot to mention.
</role>

<task>
Analyze the user's request using deep, structured reasoning. Consider all possibilities.
You MUST think through every step internally BEFORE writing JSON. Do not start the JSON until your interpretation is clear.
Return ONLY a valid JSON object — no markdown, no code fences, no explanation.
</task>

<reasoning_process>
Before outputting JSON, think through these dimensions in order (internally — do not print this chain of thought):

STEP 0 — STATE THE JOB (mental checkpoint)
  In one sentence: what is the user actually asking you to build? (Include page type if they want About, Contact, etc.)
  If the request is vague, decide the most likely intent and note what you assumed.

STEP 1 — DECODE THE REQUEST
  What exactly is this person building? What type? What sub-type?
  Is this a FULL SITE / HOMEPAGE, or a SECONDARY PAGE (About, Contact, Projects, Services, Pricing, Blog, Legal)?
  If the user says "about page", "contact page", "create the X page", etc., you MUST treat it as that page type — NOT as a new homepage clone.
  What industry, profession, or niche does this serve?
  Extract any names, technologies, specialties, or details mentioned.

STEP 2 — IDENTIFY THE AUDIENCE
  Who will visit this website? Recruiters? Clients? Customers? End users?
  What do they care about? What questions do they need answered?
  What will make them take action?

STEP 3 — DEFINE THE GOAL
  What is the #1 thing this website must achieve? (Get hired? Make sales? Generate leads? Inform?)
  What is the secondary goal?

STEP 4 — BUILD THE NARRATIVE
  What story should this page tell, top to bottom?
  What emotional journey should a visitor experience?
  (e.g., "Impress → Trust → Curiosity → Proof → Action")

STEP 5 — LIST ALL REQUIRED SECTIONS
  What sections are ESSENTIAL for this type of site?
  What sections would the user assume are included but forgot to mention?
  Think about: navigation, social proof, proof of work, credibility, contact/conversion.

STEP 6 — DESIGN PSYCHOLOGY
  What colors evoke the right emotions for this profession/industry?
  What design style will make this stand out vs generic sites in this field?
  What visual tone matches their brand/personality?

STEP 7 — CONTENT STRATEGY
  What tone of voice fits this website? (Professional, creative, warm, technical?)
  What kind of content will resonate with the audience?
</reasoning_process>

<output_schema>
{
  "whatUserWants": "REQUIRED first. One clear sentence in everyday language: what you will build for the user. Resolve ambiguity (e.g. 'About page for their portfolio', not just 'a website').",
  "whyThisInterpretation": ["REQUIRED. 2-5 short strings: how you read the request, what you assumed, what you ruled out, any page-type or audience decisions"],
  "websiteType": "portfolio|ecommerce|saas|blog|restaurant|agency|landing|event|education|personal|other",
  "subType": "specific sub-type e.g. developer|designer|photographer|consultant|startup|fashion|food|fitness|medical|real-estate|non-profit|freelancer|gym|course-platform|conference|wedding|music|law-firm",
  "profession": "Exact professional title or business type",
  "targetAudience": "Who will visit this — be specific (e.g. 'Tech recruiters and startup founders')",
  "primaryGoal": "The #1 conversion goal of this page",
  "pageNarrative": "The emotional story/journey: impression → trust → proof → action",
  "keyFeatures": ["features explicitly requested by the user"],
  "impliedFeatures": ["features the user NEEDS but didn't mention — max 5, be precise"],
  "mustHaveBlocks": ["ordered list of 7-9 block types that perfectly serve this use case"],
  "designStyle": "Specific visual direction e.g. 'dark terminal aesthetic with neon green accents and code-like typography'",
  "colorPsychology": "Why these colors work for this audience and goal",
  "contentTone": "professional|creative|warm|technical|luxurious|playful|bold",
  "personalization": "Extracted name, specialty, tech stack, company, or any personal detail",
  "pageRole": "home|about|contact|projects|services|pricing|blog|legal|landing|other",
  "pageScope": "full_site|single_page|secondary_page"
}
</output_schema>

<page_level_intelligence>
When <pixelprompt_builder_context> or the user request indicates a SPECIFIC PAGE in a multi-page site:
- ABOUT: mustHaveBlocks should emphasize story + credibility — NOT the same blocks as Home (avoid duplicating full skills-grid + project-card unless the user explicitly asks to repeat them). Typical: navbar, compact hero, heading, text, features (values), experience-timeline, stats, social-links, footer.
- CONTACT: mustHaveBlocks center on contact-form, map, social-links, short hero — NOT project-card or skills-grid.
- PROJECTS / WORK: project-card heavy, optional stats/cta — NOT generic "full stack developer" homepage hero copy.
- SERVICES / PRICING / BLOG / LEGAL: match the page job; never default to "portfolio homepage" templates.

If pageRole is about, contact, projects, services, pricing, blog, or legal — set pageScope to "secondary_page" and choose mustHaveBlocks for THAT page only.
</page_level_intelligence>

<industry_intelligence>

DEVELOPER PORTFOLIO:
  Audience: Recruiters, CTOs, startup founders
  Goal: Get hired or land freelance clients
  Must-haves: hero (name + role + CTA), skills-grid, project-card (3 real projects), experience-timeline, contact-form, social-links
  Narrative: "I'm impressive → Here's what I can do → Here's proof → Let's talk"
  Design: Dark theme, tech colors (green/cyan/purple neon), glassmorphism cards
  Content: Specific tech stack names, real project names with impact numbers

DESIGNER PORTFOLIO:
  Audience: Agencies, clients, creative directors
  Must-haves: hero (bold visual), gallery (best work), project-card (case studies), testimonials, contact-form
  Design: Bold typography, vibrant palette, lots of whitespace, image-heavy

PHOTOGRAPHER PORTFOLIO:
  Audience: Couples, families, brands, event organizers
  Must-haves: hero (full-bleed stunning photo), gallery (4+ images), stats (shots taken, clients served), testimonials, booking-form
  Design: Minimal dark or white, full-bleed images, elegant serif typography

SAAS PRODUCT:
  Audience: Business decision-makers, teams
  Goal: Trial signups or demo requests
  Must-haves: hero (value prop + CTA), logo-cloud (social proof), features (3-6 key features), pricing-table, testimonials, faq, cta, footer
  Narrative: "You have this problem → We solve it → Here's how → Everyone uses us → Try it"
  Design: Clean, modern, trustworthy blues/indigos

ECOMMERCE STORE:
  Audience: Shoppers
  Goal: Sales
  Must-haves: navbar, hero (offer/deal), banner (promo), product-card, features (benefits), testimonials, newsletter, footer
  Design: High contrast, trust-building, warm conversion colors

RESTAURANT/FOOD:
  Audience: Hungry locals, event planners
  Goal: Reservations and orders
  Must-haves: hero (appetizing), features (menu highlights or USPs), gallery (food photos), stats (years open, dishes), testimonials, map, contact-form, footer
  Design: Warm food colors (amber/red/golden), inviting imagery

AGENCY:
  Must-haves: hero, logo-cloud (clients), features (services), team, testimonials, stats, cta, footer
  Design: Bold, confident, modern dark or stark white

BLOG/PERSONAL:
  Must-haves: hero, blog-list, newsletter, footer
  Design: Clean, readable, content-first

EVENT/CONFERENCE:
  Audience: Potential attendees, sponsors, speakers
  Goal: Ticket sales and registrations
  Must-haves: hero (event name + date + CTA), countdown, features (event highlights), team (speakers), pricing-table (tickets), stats, testimonials, booking-form, footer
  Narrative: "This is the event → See what you'll learn → Meet the speakers → Get your ticket"
  Design: Bold, energetic with vibrant orange/yellow, dynamic feel with countdown urgency

EDUCATION/COURSE:
  Audience: Students, professionals seeking upskilling, lifelong learners
  Goal: Course enrollments and sign-ups
  Must-haves: hero (platform name + value prop), features (course highlights), stats (students/courses/ratings), testimonials (student reviews), pricing-table (plans), cta, newsletter, footer
  Narrative: "Learn from the best → See our courses → Hear from students → Start learning"
  Design: Clean, trustworthy with sky-blue/teal, educational and approachable

PERSONAL/RESUME:
  Audience: Recruiters, employers, potential clients
  Goal: Get hired, make professional connections
  Must-haves: hero (name + title + CTA), skills-grid, project-card, experience-timeline, stats, contact-form, social-links, footer
  Narrative: "Who I am → What I can do → Proof of work → Let's connect"
  Design: Dark modern with accent color, professional but memorable

FREELANCER/CONSULTANT:
  Audience: Potential clients, business decision-makers
  Must-haves: hero, features (services), testimonials, pricing-table (packages), stats, cta, contact-form, footer
  Design: Professional, trustworthy, personal brand-forward

MEDICAL/HEALTH:
  Must-haves: hero, features (services), team (doctors), testimonials, stats, booking-form, map, footer
  Design: Clean, trustworthy blues/greens, calming

REAL ESTATE:
  Must-haves: hero, product-card (listings), features (why us), stats, testimonials, contact-form, map, footer
  Design: Elegant dark/gold or modern slate

FITNESS/GYM:
  Must-haves: hero, features (programs), pricing-table (memberships), team (trainers), testimonials, stats, booking-form, gallery, footer
  Design: Bold, energetic with dark backgrounds and neon accents

NON-PROFIT:
  Must-haves: hero, features (impact areas), stats (impact numbers), testimonials, team, cta (donate), newsletter, footer
  Design: Warm, inspiring with earthy tones or hopeful greens
</industry_intelligence>`;

// ── PHASE 1: Planner Prompt ───────────────────────────────────────────────────
// Uses discovery to craft a purposeful narrative page structure.

const PLANNER_SYSTEM = `<role>
Expert UI architect for PixelPrompt. You design pages that tell stories.
Every block you choose has a REASON. Every section moves the visitor one step closer to the goal.
You think about page flow, attention spans, and conversion psychology.
</role>

<task>
Given the discovery analysis and user prompt, design the perfect website structure.
FIRST read <locked_user_intent> inside discovery_analysis (if present). Your block list must directly implement THAT intent — do not invent a different product or page type.
Only after the intent is clear, choose blocks and order.
Return ONLY a valid JSON object — no markdown, no code fences.
</task>

<output_schema>
{
  "intent": "precise one-sentence description of what to build",
  "style": "very specific visual design direction with mood, effects, and typography notes",
  "blocks": ["ordered block types — each chosen for a specific reason"],
  "colorScheme": {
    "primary": "#hex — main brand color",
    "secondary": "#hex — supporting dark/light variant",
    "background": "#hex — page background",
    "text": "#hex — body text",
    "accent": "#hex — highlights, CTAs, accents"
  }
}
</output_schema>

<design_rules>
0. SECONDARY PAGES (About, Contact, Projects, etc.): If the user message includes <inferred_page_role> that is NOT "home" or "landing", you MUST design that page type only. Do NOT copy the Home/portfolio flow (hero + skills-grid + project-card + contact-form) unless the role is explicitly "home". About needs story/credibility blocks; Contact needs form/map/social; Projects needs project-card focus.

1. BLOCKS: 7–12 items. Every block serves the page goal. No filler.

2. VARY THE ORDER — Do NOT always use hero → features → testimonials → footer. Match the narrative arc:
   - Portfolio: navbar → hero → stats → skills-grid → project-card → experience-timeline → testimonials → contact-form → footer
   - SaaS: navbar → hero → logo-cloud → process-steps → features → comparison-table → pricing-table → faq → cta → footer
   - Restaurant: navbar → hero → banner → features → gallery → menu-grid → stats → testimonials → booking-form → map → footer
   - Agency: hero → logo-cloud → service-card → process-steps → team → stats → testimonials → cta → footer
   - Event: navbar → hero → countdown → features → event-schedule → team → pricing-table → faq → newsletter → footer
   - Ecommerce: navbar → hero → banner → product-card → features → stats → testimonials → newsletter → footer

3. MANDATORY COLOR VARIETY — Choose ONE palette from this list. You MUST pick a different feel each time based on the user's industry and personality. Do NOT default to the same dark-blue-purple combo every time.

   ── DARK THEMES ──
   "Terminal Green"  → bg:#050f05  text:#e2ffe2  primary:#00e676  secondary:#004d20  accent:#69ff47
   "Neon Tokyo"      → bg:#06001a  text:#fff0ff  primary:#ff2d78  secondary:#3d0066  accent:#b300ff
   "Arctic Night"    → bg:#020d1c  text:#dff4ff  primary:#00b0ff  secondary:#003366  accent:#40c4ff
   "Crimson Noir"    → bg:#0d0105  text:#fff0f3  primary:#ff1744  secondary:#4a0010  accent:#ff80ab
   "Amber Forge"     → bg:#0c0800  text:#fff8e7  primary:#ffa000  secondary:#3d2000  accent:#ffca28
   "Ocean Abyss"     → bg:#010d16  text:#e0fafa  primary:#00bcd4  secondary:#00363a  accent:#84ffff
   "Violet Surge"    → bg:#07030f  text:#f5e8ff  primary:#aa00ff  secondary:#220040  accent:#e040fb
   "Gold Matrix"     → bg:#080700  text:#fffff0  primary:#ffd600  secondary:#3d2f00  accent:#ffab40
   "Jade Dark"       → bg:#010f07  text:#e8fff4  primary:#00c853  secondary:#003319  accent:#b9f6ca
   "Cobalt Strike"   → bg:#010413  text:#e8ecff  primary:#3d5afe  secondary:#000e70  accent:#7986cb

   ── LIGHT THEMES ──
   "Clean Mint"      → bg:#f0fdf4  text:#052e16  primary:#16a34a  secondary:#dcfce7  accent:#4ade80
   "Rose Canvas"     → bg:#fff1f2  text:#4c0519  primary:#e11d48  secondary:#ffe4e6  accent:#fb7185
   "Sky Platform"    → bg:#f0f9ff  text:#0c4a6e  primary:#0369a1  secondary:#e0f2fe  accent:#38bdf8
   "Warm Peach"      → bg:#fff7ed  text:#7c2d12  primary:#ea580c  secondary:#ffedd5  accent:#fb923c
   "Lavender Dream"  → bg:#f5f3ff  text:#2e1065  primary:#7c3aed  secondary:#ede9fe  accent:#a78bfa
   "Editorial White" → bg:#ffffff  text:#111111  primary:#111111  secondary:#f5f5f5  accent:#6d28d9
   "Lemon Fresh"     → bg:#fefce8  text:#422006  primary:#ca8a04  secondary:#fef9c3  accent:#a3e635
   "Blush Pro"       → bg:#fdf4ff  text:#3b0764  primary:#a21caf  secondary:#fae8ff  accent:#e879f9
   "Sage Studio"     → bg:#f7fef5  text:#052e08  primary:#15803d  secondary:#dcfce7  accent:#86efac

   ── BOLD / VIVID THEMES ──
   "Electric Dusk"   → bg:#0a0022  text:#f0e8ff  primary:#7c3aed  secondary:#2d0070  accent:#f0abfc
   "Sunset Blaze"    → bg:#1a0533  text:#fff0e8  primary:#ff5722  secondary:#4a1000  accent:#ff9100
   "Coral Punch"     → bg:#1a0600  text:#fff3ee  primary:#ff4500  secondary:#4d1300  accent:#ff8c42
   "Deep Grape"      → bg:#0d0018  text:#f3e5ff  primary:#8b00ff  secondary:#26004d  accent:#ce93d8
   "Forest Pro"      → bg:#011a04  text:#f0fff4  primary:#15803d  secondary:#022808  accent:#86efac
   "Retro Pop"       → bg:#fef3c7  text:#1c1917  primary:#d97706  secondary:#fde68a  accent:#f43f5e
   "Neo Brutalist"   → bg:#f5f500  text:#000000  primary:#000000  secondary:#e5e500  accent:#ff0066

4. DESIGN PERSONALITY — The "style" field MUST describe one of these unique aesthetics (rotate through them, don't repeat):
   - "Brutalist — heavy black borders, oversized bold typography, raw geometric shapes, high contrast"
   - "Glassmorphism — frosted glass cards with blur backdrop, subtle 1px borders, layered depth"
   - "Editorial magazine — asymmetric sections, serif display headlines, dramatic type scale, art direction"
   - "Cyberpunk terminal — neon glow effects, scanline aesthetic, monospace accent fonts, glitch energy"
   - "Minimalist zen — extreme whitespace, whisper-thin dividers, restrained color, premium breathing room"
   - "Bold startup — thick geometric accents, gradient fills, oversized numbers/stats, kinetic energy"
   - "Luxury dark — champagne gold accents, refined micro-typography, opulent dark backgrounds"
   - "Flat illustrated — clean block colors, friendly rounded shapes, playful icon-driven layout"
   - "Retro nostalgic — warm paper tones, vintage typography, distressed textures, nostalgic charm"
   - "Neon night — vivid neon highlights on very dark backgrounds, electric glow, club energy"

5. SECTION BACKGROUND RHYTHM — MANDATORY variety within a page:
   - Hero: ALWAYS the primary/brand color or gradient-inspired background — make it dramatic
   - Features/Services section: use secondary color (slightly lighter than page bg)
   - Stats/Numbers: use accent-tinted background for punch
   - Testimonials: use a distinctly different bg from neighboring sections
   - CTA/Newsletter: use PRIMARY color bg for maximum contrast + white text
   - Footer: always near-black (#0c0c0c) or very dark regardless of theme
   RULE: No two consecutive sections can have the same backgroundColor hex.

6. PORTFOLIO (HOME/LANDING ONLY): When building the main portfolio home page, include project-card + skills-grid. NON-NEGOTIABLE for that case. Do NOT force these on About, Contact, or other secondary pages unless the user explicitly asks.
7. EVENT: ALWAYS include countdown + event-schedule + pricing-table.
8. EDUCATION: ALWAYS include course-card + stats + testimonials.
9. PERSONAL/RESUME: ALWAYS include skills-grid + experience-timeline + project-card + contact-form.
10. SAAS: ALWAYS include process-steps + features + pricing-table. Add comparison-table if 8+ blocks.
11. RESTAURANT: ALWAYS include menu-grid + gallery + booking-form.
12. AGENCY: ALWAYS include service-card + process-steps + team.
13. ANTI-REPETITION: FORBIDDEN patterns — DO NOT generate these tired combinations:
    - Generic "#3b82f6 blue + white" for every SaaS
    - Plain white background with gray sections
    - Same hero → features → testimonials → pricing every time
    - Identical stats: "10K Users", "99.9% Uptime" for every product
    - Generic "Feature 1, Feature 2, Feature 3" with placeholder descriptions
</design_rules>

<available_blocks>
hero, navbar, footer, features, testimonials, pricing-table, stats, team, gallery,
faq, contact-form, newsletter, logo-cloud, cta, banner, heading, text, button,
image, divider, spacer, countdown, product-card, social-links, video,
blog-post, blog-list, cart, checkout-form, map, booking-form, login-form,
project-card, experience-timeline, skills-grid,
process-steps, service-card, menu-grid, event-schedule, course-card, comparison-table
</available_blocks>`;

// ── PHASE 2: Coder Prompt ─────────────────────────────────────────────────────
// Generates deeply specific, professional, industry-aware content.

const CODER_SYSTEM = `You are a JSON block generator for PixelPrompt. Output ONLY a valid JSON array. Start with [ end with ]. No markdown, no explanation, no code fences.

BLOCK FORMAT: {"id":"8charId","type":"blockType","props":{...},"style":{"backgroundColor":"#hex","textColor":"#hex","animation":"slide-up","animationDuration":"0.8","animationDelay":"0.1"}}

RULES:
- Unique 8-char alphanumeric id per block
- Use exact color scheme given. Dark bg = light text. NEVER same bg as text color.
- Alternate backgroundColor between sections (never same hex twice in a row)
- Every style needs animation (fade-in|slide-up|slide-down|slide-left|slide-right|zoom-in|bounce), animationDuration 0.5-1.0, animationDelay 0-0.5
- NO placeholder text. Write real specific content matching the profession/business.
- features: 3-6 items with real titles+descriptions. skills-grid: 8-12 real skills with level 0-100. project-card: exactly 3 projects with title,description,image,techStack,liveUrl("#"),repoUrl("#"). experience-timeline: 3-4 entries. stats: 3-4 credible numbers. testimonials: full name+role+company+specific outcome quote.
- Images: use Unsplash URLs provided in the request. Pick different ones for variety.
- footer: real columns (Company/Product/Resources/Legal) with 3-5 links each + copyright with current year.
- SECONDARY PAGE: If the plan intent is About/Contact/Projects (check <intent> and user context), hero title/subtitle must match THAT page (e.g. "About Jane" / "Let's work together" for contact) — never recycle the generic homepage value-prop headline unless building Home.

PROPS REFERENCE:
hero:{title,subtitle,buttonText,backgroundImage?}|navbar:{brand,links:[{label,url}],ctaText?}|footer:{columns:[{title,links:[string]}],copyright}|features:{features:[{title,desc,icon?}]}|testimonials:{testimonials:[{name,role,quote,rating?}]}|pricing-table:{plans:[{name,price,features:[string],highlighted:boolean}]}|stats:{stats:[{value,label}]}|team:{members:[{name,role,bio,image}]}|gallery:{images:[{src,alt}]}|faq:{title,items:[{question,answer}]}|contact-form:{title,subtitle,buttonText}|newsletter:{title,subtitle,buttonText}|logo-cloud:{title,logos:[string]}|cta:{title,subtitle,primaryButton,secondaryButton}|countdown:{title,subtitle,targetDate}|product-card:{products:[{name,price,description,image,badge?}]}|social-links:{links:[{platform,url}]}|blog-list:{title,posts:[{title,excerpt,author,date,category}]}|map:{address,zoom,height}|booking-form:{title,subtitle,buttonText,services:[string]}|project-card:{title,projects:[{title,description,image,techStack:[string],liveUrl,repoUrl}]}|experience-timeline:{title,items:[{title,company,period,description}]}|skills-grid:{title,skills:[{name,level,icon:"code"|"design"|"cloud"|"data"|"mobile"|"devops"}]}|process-steps:{title,steps:[{stepNumber,title,description}]}|service-card:{title,services:[{icon,title,description,price?}]}|menu-grid:{title,categories:[{name,items:[{name,price,description}]}]}|event-schedule:{title,days:[{date,slots:[{time,title,speaker,description}]}]}|course-card:{title,courses:[{title,instructor,rating,students,price,image,category}]}|comparison-table:{title,features:[string],plans:[{name,values:[string|boolean]}]}`;

// ── PHASE 3: Reviewer Prompt ──────────────────────────────────────────────────
// Deep quality pass — catches everything the Coder might have missed.

const REVIEWER_SYSTEM = `<role>
Senior quality director for PixelPrompt. You have an eye for detail and high standards.
You check every block for quality, consistency, coherence, and professionalism.
You fix issues, not just report them.
</role>

<task>
Review the generated blocks JSON array. Find and fix ALL issues. Return the corrected JSON array.
Return ONLY the minified JSON array — no markdown, no explanation.
</task>

<comprehensive_checklist>

STRUCTURAL CHECKS:
✓ navbar must be first block if present
✓ footer must be last block if present
✓ no two identical block types in a row (unless section/spacer/divider)
✓ page starts with a visual section (hero or image or gallery) — not a form
✓ If the user asked for About/Contact/Projects page: hero copy must NOT be a duplicate generic "full stack developer crafting innovative solutions" homepage pitch — tailor to the page type

CONTENT QUALITY:
✓ No placeholder text: "Feature 1", "Lorem ipsum", "Company A", "Your Title", "Skill 1", "New Feature", "Description" etc.
  → Replace with specific, realistic, professional content matching the website type
✓ Hero title must be specific and compelling — not generic
✓ All testimonials must have full names + specific roles + convincing quotes with outcomes
✓ All stats must be credible and impressive for the industry
✓ Footer copyright must include a real year (2025) and company/person name
✓ Features must have descriptive titles and 2+ sentence descriptions, not just "Description"
✓ Newsletter/CTA blocks must have compelling, specific titles — not "Stay Updated" or "Get Started"

PORTFOLIO BLOCKS (if present):
✓ project-card.projects must be an array of 3 items with all fields filled
  → Each must have title (real project name), description (2 sentences with impact),
  → techStack (3-5 items), liveUrl, repoUrl — NEVER empty arrays
✓ experience-timeline.items must have 3+ entries with specific companies and periods
✓ skills-grid.skills must have 8+ entries, all with level (0-100) and valid icon type
  → icon must be one of: "code", "design", "cloud", "data", "mobile", "devops"

EVENT BLOCKS (if countdown present):
✓ countdown must have a targetDate in YYYY-MM-DD format (use a future date)
✓ team members should be labelled as "speakers" with talk topics in bio
✓ pricing-table plans should be ticket tiers (Early Bird, Regular, VIP)

EDUCATION BLOCKS (if present):
✓ features should describe course benefits or highlights
✓ stats should include student count, course count, satisfaction rate
✓ testimonials should be from students with specific outcomes

PERSONAL/RESUME BLOCKS (if present):
✓ skills-grid must have 8+ skills with realistic levels
✓ experience-timeline must have 3+ entries with career progression
✓ project-card must show 3 projects with specific descriptions

VISUAL QUALITY:
✓ Every block has backgroundColor AND textColor in style
✓ No white text on white background, no black text on black background
✓ Section backgrounds alternate to create visual rhythm (not all same color)
✓ Every block has style.animation set (not empty, not "none")
✓ animationDuration is between 0.4 and 1.0 (seconds as string)

ID INTEGRITY:
✓ All block IDs are unique 8-character alphanumeric strings
✓ No duplicate IDs — generate new ones for duplicates

BLOCK VALIDITY:
✓ Remove any blocks with types not in the valid type list
✓ Do not add new blocks unless critical content is missing
</comprehensive_checklist>

<important>
Fix issues directly — do not just remove content.
If a field is bad/empty, write good content for it.
If IDs are duplicated, assign new nanoid-style IDs.
Return all original blocks (minus invalid types), fully corrected.
</important>`;

// ── CV Parser Prompt ──────────────────────────────────────────────────────────

const CV_PARSER_SYSTEM = `<role>Expert CV/resume parser for PixelPrompt portfolio builder.</role>

<task>
Parse the CV/resume text below. Extract all structured data.
Return ONLY a valid JSON object — no markdown, no code fences.
</task>

<output_schema>
{
  "name": "Full name",
  "title": "Professional headline or current job title",
  "summary": "2-3 sentence professional bio derived from experience",
  "email": "email if present",
  "phone": "phone if present",
  "location": "City, Country if present",
  "website": "personal website URL if present",
  "github": "GitHub profile URL if present",
  "linkedin": "LinkedIn URL if present",
  "skills": [{"name": "Skill Name", "level": 80, "icon": "code|design|cloud|data|mobile|devops"}],
  "experience": [{"title": "Job Title", "company": "Company Name", "period": "Jan 2022 – Present", "description": "2-sentence summary of responsibilities and key achievements with numbers"}],
  "projects": [{"title": "Project Name", "description": "2-sentence what it does and its impact", "techStack": ["Tech1","Tech2"], "liveUrl": "#", "repoUrl": "#"}],
  "education": [{"degree": "Degree Name", "institution": "Institution", "period": "2018 – 2022"}]
}
</output_schema>

<extraction_rules>
- Skills: assign level 85-95 for primary/expert skills, 70-84 for proficient, 55-69 for familiar
- icon mapping: code/programming languages/frameworks → "code", design tools → "design",
  cloud platforms → "cloud", databases/ML → "data", mobile development → "mobile", CI/CD/DevOps → "devops"
- Experience periods: format as "Mon YYYY – Mon YYYY" or "YYYY – Present"
- If summary not provided, synthesize one from the experience
- Extract ALL skills mentioned anywhere in the CV
- For projects: if GitHub/live links are in the CV, extract them
</extraction_rules>`;

// ── Orchestrator ──────────────────────────────────────────────────────────────

export async function orchestrate(
  prompt: string,
  onProgress?: ProgressCallback,
  ctx?: OrchestrationContext
): Promise<OrchestrationResult> {
  const emit = (event: ProgressEvent) => onProgress?.(event);
  const tasks: AgentTask[] = [];
  const augmented = wrapUserPromptForAgents(prompt, ctx);
  const resolvedPageRole = inferPageRole(prompt, ctx?.targetPageName, ctx?.currentPageName);

  // ── Phase 0: Discovery ────────────────────────────────────────────────────
  let discovery: DiscoveryResult | null = null;

  const discoverTask: AgentTask = {
    id: nanoid(8),
    phase: "discover",
    description: "Think first: interpret what the user wants to build, then lock intent",
    status: "running",
  };
  tasks.push(discoverTask);

  emit({
    type: "phase_start",
    phase: "discover",
    message: "🤔 Step 1 — Thinking through what you want to build (before any design)…",
  });
  emit({ type: "task_update", task: discoverTask });

  try {
    const { content: raw, providerName, model } = await callWithFallback(
      "planner",
      [
        { role: "system", content: DISCOVERY_SYSTEM },
        { role: "user", content: augmented },
      ],
      { temperature: 0.15, maxTokens: 1536, topP: 0.9 }
    );

    discoverTask.providerName = providerName;
    discoverTask.model = model;

    const jsonStr = extractJSON(raw, "{");
    if (jsonStr) {
      const rawDiscover = JSON.parse(jsonStr) as Record<string, unknown>;
      discovery = rawDiscover as unknown as DiscoveryResult;
      if (!discovery.whyThisInterpretation?.length && Array.isArray(rawDiscover.interpretationNotes)) {
        discovery.whyThisInterpretation = normalizeInterpretationBullets(rawDiscover.interpretationNotes);
      }
      adjustDiscoveryForPageRole(discovery, resolvedPageRole);
      discoverTask.status = "done";
      discoverTask.result = {
        websiteType: discovery.websiteType,
        profession: discovery.profession,
        audience: discovery.targetAudience,
      };

      emit({
        type: "phase_end",
        phase: "discover",
        message: `✅ Understood: ${discovery.profession || discovery.websiteType} → ${discovery.primaryGoal}`,
        data: discovery,
      });
      emit({ type: "task_update", task: discoverTask });

      // Log rich discovery insight for user to see
      if (discovery.targetAudience) {
        emit({ type: "log", message: `👥 Audience: ${discovery.targetAudience}` });
      }
      if (discovery.pageNarrative) {
        emit({ type: "log", message: `📖 Page story: ${discovery.pageNarrative}` });
      }
      if (discovery.impliedFeatures?.length) {
        emit({ type: "log", message: `💡 Implied needs: ${discovery.impliedFeatures.join(", ")}` });
      }
      if (resolvedPageRole !== "home") {
        emit({ type: "log", message: `📄 Page focus: ${resolvedPageRole} (tailored layout, not a homepage clone)` });
      }

      emit({
        type: "thinking",
        phase: "intent",
        summary: synthesizeWhatUserWants(discovery, resolvedPageRole),
        bullets: synthesizeInterpretationBullets(discovery),
      });
    } else {
      throw new Error("No JSON in discovery response");
    }
  } catch (err: any) {
    discoverTask.status = "failed";
    discoverTask.error = err.message;
    emit({ type: "task_update", task: discoverTask });
    emit({ type: "log", message: `⚠️ Discovery skipped (${err.message}), proceeding with direct planning` });
    emit({
      type: "thinking",
      phase: "intent",
      summary:
        resolvedPageRole !== "home"
          ? `Build a ${resolvedPageRole} page matching your request (deep analysis skipped).`
          : `Build from your prompt (deep analysis skipped): ${prompt.slice(0, 160)}${prompt.length > 160 ? "…" : ""}`,
      bullets: ["Using keyword + planner fallback because the understanding step did not return valid JSON."],
    });
  }

  // ── Phase 1: Planner ──────────────────────────────────────────────────────
  const planTask: AgentTask = {
    id: nanoid(8),
    phase: "plan",
    description: "Architect page flow — choose blocks that tell a story",
    status: "running",
  };
  tasks.push(planTask);

  emit({
    type: "phase_start",
    phase: "plan",
    message: "🧠 Step 2 — Planning structure that matches that intent…",
  });
  emit({ type: "task_update", task: planTask });

  let plan: PlanResult;

  try {
    const discoveryCtx = discovery
      ? buildDiscoveryContext(discovery, resolvedPageRole)
      : "";

    const plannerMsg = `${discoveryCtx}

${augmented}

Design the optimal page structure. Every block choice must serve the goal: "${discovery?.primaryGoal || "impress visitors and drive action"}".
The page narrative should be: "${discovery?.pageNarrative || "engage → inform → convince → convert"}".`;

    const { content: raw, providerName, model } = await callWithFallback(
      "planner",
      [
        { role: "system", content: PLANNER_SYSTEM },
        { role: "user", content: plannerMsg },
      ],
      { temperature: 0.25, maxTokens: 1200, topP: 0.9 }
    );

    planTask.providerName = providerName;
    planTask.model = model;

    const jsonStr = extractJSON(raw, "{");
    if (!jsonStr) throw new Error("Planner response contained no JSON");

    plan = JSON.parse(jsonStr) as PlanResult;

    if (!plan.blocks || !Array.isArray(plan.blocks) || plan.blocks.length === 0) {
      plan.blocks = discovery?.mustHaveBlocks?.filter((b) => VALID_TYPES.has(b))
        || ["navbar", "hero", "features", "cta", "footer"];
    }
    plan.blocks = plan.blocks.filter((b) => VALID_TYPES.has(b));

    if (!plan.colorScheme) {
      plan.colorScheme = defaultColorScheme(discovery?.websiteType);
    }

    planTask.status = "done";
    planTask.result = { blockCount: plan.blocks.length, intent: plan.intent };

    emit({
      type: "phase_end",
      phase: "plan",
      message: `✅ Plan ready (${providerName}): ${plan.intent}`,
      data: plan,
    });
    emit({ type: "task_update", task: planTask });
    emit({ type: "log", message: `📋 ${plan.blocks.length} blocks in order: ${plan.blocks.join(" → ")}` });
    emit({ type: "log", message: `🎨 Style: ${plan.style}` });
  } catch (err: any) {
    planTask.status = "failed";
    planTask.error = err.message;
    emit({ type: "task_update", task: planTask });
    emit({ type: "log", message: `⚠️ Planner failed (${err.message}), using intelligent fallback` });
    plan = buildFallbackPlan(prompt, discovery, resolvedPageRole);
  }

  emit({
    type: "thinking",
    phase: "structure",
    summary: plan.intent,
    bullets: [
      `Sections in order: ${plan.blocks.join(" → ")}`,
      plan.style ? `Look & feel: ${plan.style.length > 220 ? `${plan.style.slice(0, 220)}…` : plan.style}` : "",
    ].filter(Boolean),
  });

  // ── Phase 2: Coder ────────────────────────────────────────────────────────
  const codeTask: AgentTask = {
    id: nanoid(8),
    phase: "code",
    description: `Generate ${plan.blocks.length} blocks with specific, professional content`,
    status: "running",
  };
  tasks.push(codeTask);

  emit({
    type: "phase_start",
    phase: "code",
    message: `⚡ Step 3 — Building ${plan.blocks.length} blocks from the plan…`,
  });
  emit({ type: "task_update", task: codeTask });

  let rawBlocks: ValidBlock[] = [];

  try {
    const totalBlocks = plan.blocks.length;
    const batchSize = 3; // Generate 3 blocks at a time to prevent truncation/memory issues
    const batches = Math.ceil(totalBlocks / batchSize);

    for (let b = 0; b < batches; b++) {
      const start = b * batchSize;
      const end = Math.min(start + batchSize, totalBlocks);
      const currentBlocks = plan.blocks.slice(start, end);

      emit({
        type: "log",
        message: `⚡ Generating batch ${b + 1}/${batches} (${currentBlocks.join(", ")})...`
      });

      const pageRoleHint =
        resolvedPageRole !== "home"
          ? `\n<page_generation_focus>${resolvedPageRole}</page_generation_focus>
The blocks you output must read as a "${resolvedPageRole}" page — not a duplicate homepage marketing hero unless this batch is explicitly the navbar/footer.`
          : "";

      const personalization = discovery
        ? `\n<personalization>
Person: ${discovery.profession}${discovery.personalization ? ` — ${discovery.personalization}` : ""}
Audience: ${discovery.targetAudience}
Content tone: ${discovery.contentTone}
Generate content that is authentic, specific, and tailored to this exact profile. No generic placeholders.
</personalization>${pageRoleHint}`
        : pageRoleHint || "";

      const historyCtx = rawBlocks.length > 0
        ? `\n<blocks_already_generated_in_this_session>
${JSON.stringify(rawBlocks.map(rb => ({ type: rb.type, props: rb.props })))}
</blocks_already_generated_in_this_session>`
        : "";

      const imageUrls = getContextualImages(discovery?.websiteType ?? "landing", discovery?.subType ?? "");

      const coderMsg = `<plan>
<intent>${plan.intent}</intent>
<style>${plan.style}</style>
<color_scheme>${JSON.stringify(plan.colorScheme)}</color_scheme>
</plan>
${personalization}
${historyCtx}
<images_to_use>
${imageUrls}
</images_to_use>

Generate ONLY these ${currentBlocks.length} block(s) as a JSON array: ${currentBlocks.join(", ")}
Return [ ... ] only. No text before or after.`;

      const { content: raw, providerName, model } = await callWithFallbackValidated(
        "coder",
        [
          { role: "system", content: CODER_SYSTEM },
          { role: "user", content: coderMsg },
        ],
        { temperature: 0.7, maxTokens: 12288, topP: 0.95 },
        (content) => {
          // Some model responses come back as wrapper objects instead of a top-level array.
          // Downstream consumers expect a real `[...]` array, so we validate that contract here.
          const arrStr = extractJSON(content, "[");
          if (!arrStr) return false;
          try {
            const parsed = JSON.parse(arrStr) as unknown;
            if (!Array.isArray(parsed) || parsed.length === 0) return false;
            return (parsed as unknown[]).some((b) => {
              if (!b || typeof b !== "object") return false;
              const t = (b as Record<string, unknown>).type;
              return typeof t === "string" && VALID_TYPES.has(t);
            });
          } catch {
            return false;
          }
        }
      );

      codeTask.providerName = providerName;
      codeTask.model = model;

      const parsed = extractBlocks(raw);
      if (!parsed || parsed.length === 0) throw new Error(`Batch ${b + 1} failed: No blocks found.`);
      const validBatch = parsed
        .filter((bl) => bl !== null && VALID_TYPES.has(bl.type))
        .slice(0, currentBlocks.length);

      rawBlocks.push(...ensureUniqueIds(validBatch));
    }

    if (rawBlocks.length === 0) throw new Error("No valid blocks generated.");

    codeTask.status = "done";
    codeTask.result = { blockCount: rawBlocks.length };

    emit({
      type: "phase_end",
      phase: "code",
      message: `✅ ${rawBlocks.length} blocks generated successfully`,
    });
    emit({ type: "task_update", task: codeTask });
  } catch (err: any) {
    codeTask.status = "failed";
    codeTask.error = err.message;
    emit({ type: "task_update", task: codeTask });
    emit({ type: "log", message: `⚠️ AI coder unavailable (${err.message}), using structured fallback...` });
    // TypeScript fallback: build a complete, styled page without AI
    rawBlocks = generateFallbackBlocks(plan, discovery);
    codeTask.status = "done";
    codeTask.result = { blockCount: rawBlocks.length, fallback: true };
    emit({ type: "phase_end", phase: "code", message: `✅ ${rawBlocks.length} blocks generated (fallback mode)` });
    emit({ type: "task_update", task: codeTask });
  }

  // ── Phase 3: Reviewer ─────────────────────────────────────────────────────
  const reviewTask: AgentTask = {
    id: nanoid(8),
    phase: "review",
    description: `Deep quality check — content, structure, visual coherence`,
    status: "running",
  };
  tasks.push(reviewTask);

  emit({
    type: "phase_start",
    phase: "review",
    message: `🔍 Reviewing quality, content, and visual coherence...`,
  });
  emit({ type: "task_update", task: reviewTask });

  let finalBlocks = rawBlocks;

  try {
    const reviewMsg = `<context>
User request: ${prompt}
Website type: ${discovery?.websiteType || "general"} — ${discovery?.profession || ""}
Target audience: ${discovery?.targetAudience || "general visitors"}
Primary goal: ${discovery?.primaryGoal || "engage visitors"}
Color scheme: ${JSON.stringify(plan.colorScheme)}
</context>

<blocks_to_review>
${JSON.stringify(rawBlocks)}
</blocks_to_review>

Perform a comprehensive quality review. Fix ALL issues found. Return the corrected JSON array.`;

    const { content: raw, providerName, model } = await callWithFallback(
      "reviewer",
      [
        { role: "system", content: REVIEWER_SYSTEM },
        { role: "user", content: reviewMsg },
      ],
      { temperature: 0.15, maxTokens: 8192 }
    );

    reviewTask.providerName = providerName;
    reviewTask.model = model;

    const jsonStr2 = extractJSON(raw, "[");
    if (jsonStr2) {
      const reviewed = JSON.parse(jsonStr2) as unknown[];
      const validReviewed = reviewed.filter(
        (b): b is ValidBlock =>
          b !== null &&
          typeof b === "object" &&
          "type" in b &&
          VALID_TYPES.has((b as any).type)
      );

      if (validReviewed.length > 0) {
        finalBlocks = ensureUniqueIds(validReviewed);
      }
    }

    reviewTask.status = "done";
    reviewTask.result = { blockCount: finalBlocks.length };

    emit({
      type: "phase_end",
      phase: "review",
      message: `✅ Quality review done (${providerName}): ${finalBlocks.length} polished blocks`,
    });
    emit({ type: "task_update", task: reviewTask });
  } catch (err: any) {
    reviewTask.status = "failed";
    reviewTask.error = err.message;
    emit({ type: "task_update", task: reviewTask });
    emit({ type: "log", message: `⚠️ Reviewer skipped (${err.message}), using coder output` });
  }

  return {
    blocks: finalBlocks,
    plan,
    tasks,
    message: buildSummaryMessage(finalBlocks.length, tasks),
  };
}

// ── CV Text Parser ─────────────────────────────────────────────────────────────

export async function parseCVText(cvText: string): Promise<Record<string, unknown>> {
  const { content: raw } = await callWithFallback(
    "planner",
    [
      { role: "system", content: CV_PARSER_SYSTEM },
      { role: "user", content: `Parse this CV/resume:\n\n${cvText.slice(0, 8000)}` },
    ],
    { temperature: 0.1, maxTokens: 4096 }
  );

  const jsonStr = extractJSON(raw, "{");
  if (!jsonStr) throw new Error("Could not parse CV content — please ensure the file is readable text");
  return JSON.parse(jsonStr);
}

/** Convert the output of parseCVText into ready-to-apply portfolio blocks. */
export function buildPortfolioBlocksFromCV(parsed: Record<string, unknown>): ValidBlock[] {
  const blocks: ValidBlock[] = [];

  if (parsed.name || parsed.title) {
    blocks.push({
      id: nanoid(8),
      type: "hero",
      props: {
        title: `Hi, I'm ${parsed.name || "Your Name"}`,
        subtitle: parsed.summary || `${parsed.title || "Professional"} — passionate about building great things.`,
        buttonText: "View My Work",
      },
      style: { backgroundColor: "#09090b", textColor: "#fafafa", animation: "fade-in", animationDuration: "0.8" },
    });
  }

  if (Array.isArray(parsed.skills) && parsed.skills.length > 0) {
    blocks.push({
      id: nanoid(8),
      type: "skills-grid",
      props: { title: "Skills & Technologies", skills: (parsed.skills as unknown[]).slice(0, 16) },
      style: { backgroundColor: "#111111", textColor: "#fafafa", animation: "slide-up", animationDuration: "0.7" },
    });
  }

  if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
    blocks.push({
      id: nanoid(8),
      type: "project-card",
      props: { title: "Featured Projects", projects: (parsed.projects as unknown[]).slice(0, 6) },
      style: { backgroundColor: "#0a0a0a", textColor: "#fafafa", animation: "zoom-in", animationDuration: "0.6" },
    });
  }

  if (Array.isArray(parsed.experience) && parsed.experience.length > 0) {
    blocks.push({
      id: nanoid(8),
      type: "experience-timeline",
      props: { title: "Work Experience", items: (parsed.experience as unknown[]).slice(0, 5) },
      style: { backgroundColor: "#111111", textColor: "#fafafa", animation: "slide-left", animationDuration: "0.7" },
    });
  }

  blocks.push({
    id: nanoid(8),
    type: "contact-form",
    props: {
      title: "Get in Touch",
      subtitle: parsed.email ? `Reach me at ${parsed.email}` : "Let's work together",
      buttonText: "Send Message",
    },
    style: { backgroundColor: "#09090b", textColor: "#fafafa", animation: "fade-in", animationDuration: "0.6" },
  });

  const socialLinks: Array<{ platform: string; url: string }> = [];
  if (parsed.github) socialLinks.push({ platform: "GitHub", url: parsed.github as string });
  if (parsed.linkedin) socialLinks.push({ platform: "LinkedIn", url: parsed.linkedin as string });
  if (parsed.website) socialLinks.push({ platform: "Website", url: parsed.website as string });
  if (socialLinks.length > 0) {
    blocks.push({
      id: nanoid(8),
      type: "social-links",
      props: { links: socialLinks },
      style: { backgroundColor: "#0a0a0a", textColor: "#fafafa", animation: "fade-in" },
    });
  }

  return blocks;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Unsplash image library (injected per-request, not in system prompt) ────────

const UNSPLASH: Record<string, string[]> = {
  portfolio:  ["photo-1555099962-4199c345e5dd","photo-1461749280684-dccba630e2f6","photo-1498050108023-c5249f4df085","photo-1504639725590-34d0984388bd"],
  design:     ["photo-1561070791-2526d30994b5","photo-1626785774573-4b799315345d","photo-1558618666-fcd25c85cd64","photo-1572044162444-ad60f128bdea"],
  restaurant: ["photo-1546069901-ba9599a7e63c","photo-1504674900247-0877df9cc836","photo-1555939594-58d7cb561ad1","photo-1565299624946-b28f40a0ae38"],
  ecommerce:  ["photo-1523275335684-37898b6baf30","photo-1491553895911-0055eca6402d","photo-1585386959984-a4155224a1ad","photo-1542291026-7eec264c27ff"],
  team:       ["photo-1573497019940-1c28c88b4f3e","photo-1560250097-0b93528c311a","photo-1507003211169-0a1dd7228f2d","photo-1494790108377-be9c29b29330"],
  tech:       ["photo-1518770660439-4636190af475","photo-1550751827-4bd374c3f58b","photo-1526374965328-7f61d4dc18c5","photo-1581090700227-1e37b190418e"],
  event:      ["photo-1540575467063-178a50c2df87","photo-1505373877841-8d25f7d46678","photo-1587825140708-dfaf72ae4b04"],
  education:  ["photo-1524178232363-1fb2b075b655","photo-1427504494785-3a9ca7044f45","photo-1456513080510-7bf3a84b82f8"],
  fitness:    ["photo-1534438327276-14e5300c3a48","photo-1517836357463-d25dfeac3438","photo-1571019613454-1cb2f99b2d8b"],
  medical:    ["photo-1576091160550-2173dba999ef","photo-1559757175-7cb057fba93c","photo-1505751172876-fa1923c5c528"],
  realestate: ["photo-1564013799919-ab600027ffc6","photo-1560518883-ce09059eeffa","photo-1600596542815-ffad4c1539a9"],
  nature:     ["photo-1441974231531-c6227db76b6e","photo-1506905925346-21bda4d32df4","photo-1469474968028-56623f02e42e"],
  office:     ["photo-1497366216548-37526070297c","photo-1497366754035-f200968a6e72","photo-1486406146926-c627a92ad1ab"],
  photo:      ["photo-1452587925148-ce544e77e70d","photo-1617196034183-421b4040ed20","photo-1502982720700-bfff97f2ecac"],
  music:      ["photo-1511671782779-c97d3d27a1d4","photo-1493225457124-a3eb161ffa5f"],
  travel:     ["photo-1488085061387-422e29b40080","photo-1530789253388-582c481c54b0"],
  dark:       ["photo-1451187580459-43490279c0fa","photo-1534796636912-3b95b3ab5986","photo-1419242902214-272b3f66ee7a","photo-1478760329108-5c3ed9d495a0"],
};

function getContextualImages(type: string, subType = ""): string {
  const key = ((): keyof typeof UNSPLASH => {
    if (type === "portfolio") return subType.includes("photo") ? "photo" : "portfolio";
    if (type === "restaurant") return "restaurant";
    if (type === "ecommerce") return "ecommerce";
    if (type === "event") return "event";
    if (type === "education") return "education";
    if (type === "saas" || type === "landing") return "tech";
    if (type === "agency") return "office";
    if (subType.includes("fitness") || subType.includes("gym")) return "fitness";
    if (subType.includes("medical") || subType.includes("health")) return "medical";
    if (subType.includes("real") || subType.includes("estate")) return "realestate";
    return "office";
  })();
  const imgs = [...(UNSPLASH[key] ?? UNSPLASH.office), ...UNSPLASH.dark];
  return imgs.map(id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`).join("\n");
}

// ── TypeScript fallback block generator ───────────────────────────────────────
// Called when ALL AI providers fail. Produces a complete, styled page so users
// never see a blank error — they always get a usable website.

function generateFallbackBlocks(plan: PlanResult, discovery: DiscoveryResult | null): ValidBlock[] {
  const cs = plan.colorScheme;
  const prof = discovery?.profession || "Professional";
  const type = discovery?.websiteType || "landing";
  const animations = ["fade-in", "slide-up", "zoom-in", "slide-left", "slide-right"];
  let animIdx = 0;
  const anim = () => ({ animation: animations[animIdx++ % animations.length], animationDuration: "0.8", animationDelay: String(((animIdx % 5) * 0.1).toFixed(1)) });

  const blocks: ValidBlock[] = [];
  const bgCycle = [cs.background, cs.secondary, cs.background, cs.secondary];
  let bgIdx = 0;
  const bg = () => bgCycle[bgIdx++ % bgCycle.length];

  for (const blockType of plan.blocks) {
    const id = nanoid(8);
    const style = { backgroundColor: bg(), textColor: cs.text, ...anim() };

    switch (blockType) {
      case "navbar":
        blocks.push({ id, type: "navbar", props: { brand: prof, links: [{ label: "About", url: "#about" }, { label: "Work", url: "#work" }, { label: "Contact", url: "#contact" }] }, style: { ...style, backgroundColor: cs.background } });
        break;
      case "hero":
        blocks.push({ id, type: "hero", props: { title: `${prof} — Building What Matters`, subtitle: `Professional ${type} services delivering real results. Let's work together.`, buttonText: type === "portfolio" ? "View My Work" : "Get Started" }, style: { ...style, backgroundColor: cs.primary } });
        break;
      case "features":
        blocks.push({ id, type: "features", props: { features: [{ title: "Expert Delivery", desc: "Professional-grade work delivered on time, every time. Quality you can rely on." }, { title: "Proven Results", desc: "Track record of measurable outcomes that move the needle for clients." }, { title: "Full Support", desc: "Dedicated support throughout the project and beyond launch." }] }, style });
        break;
      case "stats":
        blocks.push({ id, type: "stats", props: { stats: [{ value: "50+", label: "Projects Completed" }, { value: "5 yrs", label: "Experience" }, { value: "98%", label: "Client Satisfaction" }, { value: "24h", label: "Response Time" }] }, style: { ...style, backgroundColor: cs.accent ?? cs.primary } });
        break;
      case "testimonials":
        blocks.push({ id, type: "testimonials", props: { testimonials: [{ name: "Alex Rivera", role: "CEO, TechCorp", quote: "Outstanding work — delivered ahead of schedule and exceeded our expectations.", rating: 5 }, { name: "Sam Chen", role: "Founder, StartupXYZ", quote: "Highly skilled and professional. Would recommend without hesitation.", rating: 5 }] }, style });
        break;
      case "skills-grid":
        blocks.push({ id, type: "skills-grid", props: { title: "Skills & Expertise", skills: [{ name: "JavaScript", level: 90, icon: "code" }, { name: "TypeScript", level: 85, icon: "code" }, { name: "React", level: 88, icon: "code" }, { name: "Node.js", level: 82, icon: "code" }, { name: "PostgreSQL", level: 78, icon: "data" }, { name: "AWS", level: 72, icon: "cloud" }, { name: "Docker", level: 75, icon: "devops" }, { name: "Figma", level: 70, icon: "design" }] }, style });
        break;
      case "project-card":
        blocks.push({ id, type: "project-card", props: { title: "Featured Projects", projects: [{ title: "SaaS Dashboard", description: "Full-stack analytics platform serving 5,000+ users. Reduced reporting time by 60%.", image: `https://images.unsplash.com/photo-1555099962-4199c345e5dd?auto=format&fit=crop&w=800&q=80`, techStack: ["React", "Node.js", "PostgreSQL"], liveUrl: "#", repoUrl: "#" }, { title: "E-Commerce Platform", description: "Scalable online store with payment integration. Processed $500K in first year.", image: `https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80`, techStack: ["Next.js", "Stripe", "MongoDB"], liveUrl: "#", repoUrl: "#" }, { title: "Mobile App", description: "Cross-platform app with 10K+ downloads and 4.8-star rating on App Store.", image: `https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80`, techStack: ["React Native", "Firebase", "TypeScript"], liveUrl: "#", repoUrl: "#" }] }, style });
        break;
      case "experience-timeline":
        blocks.push({ id, type: "experience-timeline", props: { title: "Work Experience", items: [{ title: "Senior Software Engineer", company: "Tech Company", period: "2022 – Present", description: "Led development of core platform features. Improved system performance by 40%." }, { title: "Software Engineer", company: "Digital Agency", period: "2020 – 2022", description: "Built client-facing web applications for 20+ enterprise clients." }, { title: "Junior Developer", company: "StartupXYZ", period: "2018 – 2020", description: "Developed REST APIs and frontend components for the main product." }] }, style });
        break;
      case "pricing-table":
        blocks.push({ id, type: "pricing-table", props: { plans: [{ name: "Starter", price: "$29/mo", features: ["5 projects", "Basic analytics", "Email support"], highlighted: false }, { name: "Pro", price: "$79/mo", features: ["Unlimited projects", "Advanced analytics", "Priority support", "Custom domain"], highlighted: true }, { name: "Enterprise", price: "Custom", features: ["Everything in Pro", "SLA guarantee", "Dedicated manager", "Custom integrations"], highlighted: false }] }, style });
        break;
      case "faq":
        blocks.push({ id, type: "faq", props: { title: "Frequently Asked Questions", items: [{ question: "How long does a typical project take?", answer: "Most projects are completed within 2-4 weeks depending on scope and complexity." }, { question: "Do you offer revisions?", answer: "Yes, we include up to 3 rounds of revisions in every project." }, { question: "What is your payment process?", answer: "We require 50% upfront and 50% on project completion." }] }, style });
        break;
      case "contact-form":
        blocks.push({ id, type: "contact-form", props: { title: "Get In Touch", subtitle: "Ready to start your project? Let's talk.", buttonText: "Send Message" }, style });
        break;
      case "cta":
        blocks.push({ id, type: "cta", props: { title: "Ready to Get Started?", subtitle: "Join hundreds of satisfied clients. Let's build something great together.", primaryButton: "Start Your Project", secondaryButton: "View Portfolio" }, style: { ...style, backgroundColor: cs.primary } });
        break;
      case "newsletter":
        blocks.push({ id, type: "newsletter", props: { title: "Stay in the Loop", subtitle: "Get tips, updates, and insights delivered to your inbox. No spam.", buttonText: "Subscribe" }, style });
        break;
      case "footer":
        blocks.push({ id, type: "footer", props: { columns: [{ title: "Company", links: ["About", "Services", "Portfolio", "Contact"] }, { title: "Services", links: ["Web Development", "Mobile Apps", "Consulting", "Support"] }, { title: "Resources", links: ["Blog", "Case Studies", "Documentation", "FAQ"] }], copyright: `© ${new Date().getFullYear()} ${prof}. All rights reserved.` }, style: { ...style, backgroundColor: "#0c0c0c", textColor: "#e5e7eb" } });
        break;
      case "heading":
        blocks.push({ id, type: "heading", props: { text: "Privacy & terms", level: 2 }, style });
        break;
      case "text":
        blocks.push({
          id,
          type: "text",
          props: {
            text:
              "This page explains how we collect, use, and protect information. Last updated: " +
              new Date().getFullYear() +
              ". Contact us if you have questions about these policies.",
          },
          style,
        });
        break;
      case "divider":
        blocks.push({ id, type: "divider", props: {}, style: { ...style, backgroundColor: cs.background } });
        break;
      case "map":
        blocks.push({ id, type: "map", props: { address: "Remote / worldwide — schedule a call", zoom: 12, height: 280 }, style });
        break;
      case "social-links":
        blocks.push({
          id,
          type: "social-links",
          props: {
            links: [
              { platform: "GitHub", url: "#" },
              { platform: "LinkedIn", url: "#" },
              { platform: "Twitter", url: "#" },
            ],
          },
          style,
        });
        break;
      default:
        // Skip unknown block types in fallback
        break;
    }
  }

  // Guarantee a hero for typical marketing pages — skip for legal/document-style plans
  if (!blocks.find(b => b.type === "hero") && !/legal|policy|privacy|terms/i.test(plan.intent)) {
    blocks.unshift({ id: nanoid(8), type: "hero", props: { title: `Welcome to ${prof}`, subtitle: "Professional services delivered with excellence.", buttonText: "Learn More" }, style: { backgroundColor: cs.primary, textColor: cs.text, animation: "fade-in", animationDuration: "0.8", animationDelay: "0" } });
  }
  if (!blocks.find(b => b.type === "footer")) {
    blocks.push({ id: nanoid(8), type: "footer", props: { columns: [{ title: "Links", links: ["Home", "About", "Contact"] }], copyright: `© ${new Date().getFullYear()} ${prof}` }, style: { backgroundColor: "#0c0c0c", textColor: "#e5e7eb", animation: "fade-in", animationDuration: "0.5", animationDelay: "0" } });
  }

  return ensureUniqueIds(blocks.filter(b => VALID_TYPES.has(b.type)));
}

function buildDiscoveryContext(d: DiscoveryResult, pageRole: PageRole): string {
  const locked = d.whatUserWants?.trim() || synthesizeWhatUserWants(d, pageRole);
  const notes = normalizeInterpretationBullets(d.whyThisInterpretation).join(" · ");
  return `<discovery_analysis>
<locked_user_intent>${locked}</locked_user_intent>
<interpretation_notes>${notes}</interpretation_notes>
<website_type>${d.websiteType}${d.subType ? ` / ${d.subType}` : ""}</website_type>
<profession>${d.profession}</profession>
<target_audience>${d.targetAudience}</target_audience>
<primary_goal>${d.primaryGoal}</primary_goal>
<page_narrative>${d.pageNarrative}</page_narrative>
<key_features>${d.keyFeatures?.join(", ")}</key_features>
<implied_needs>${d.impliedFeatures?.join(", ")}</implied_needs>
<must_have_blocks>${d.mustHaveBlocks?.join(", ")}</must_have_blocks>
<design_style>${d.designStyle}</design_style>
<color_psychology>${d.colorPsychology}</color_psychology>
<content_tone>${d.contentTone}</content_tone>
<personalization>${d.personalization}</personalization>
</discovery_analysis>`;
}

/** Attempts to repair common JSON issues from AI responses (trailing commas, truncation). */
function repairJSON(text: string): string {
  // Strip markdown code fences
  let s = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
  // Remove trailing commas before closing brackets
  s = s.replace(/,\s*([}\]])/g, "$1");
  // If the JSON is truncated (no closing bracket), close open objects/arrays
  const opens = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  const openArr = (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
  // Remove incomplete last element (ends mid-string or mid-object)
  s = s.replace(/,?\s*\{[^}]*$/, "").replace(/,?\s*"[^"]*$/, "");
  for (let i = 0; i < Math.max(0, opens); i++) s += "}";
  for (let i = 0; i < Math.max(0, openArr); i++) s += "]";
  return s;
}

function extractJSON(text: string, startChar: "{" | "["): string | null {
  const endChar = startChar === "{" ? "}" : "]";
  // Strip markdown code fences first
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");
  let pos = -1;

  // Try finding multiple starting points in case earlier ones are decoys
  while ((pos = cleaned.indexOf(startChar, pos + 1)) !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = pos; i < cleaned.length; i++) {
       const ch = cleaned[i];
       if (escape) { escape = false; continue; }
       if (ch === "\\") { escape = true; continue; }
       if (ch === '"') { inString = !inString; continue; }
       if (inString) continue;

       if (ch === startChar) depth++;
       else if (ch === endChar) {
         depth--;
         if (depth === 0) {
           const candidate = cleaned.slice(pos, i + 1);
           try {
             JSON.parse(candidate);
             return candidate;
           } catch {
             // Not valid JSON, keep searching for another starting point
             break;
           }
         }
       }
    }
  }

  // Repair fallback: try to fix common truncation/syntax issues
  const lastStart = cleaned.lastIndexOf(startChar);
  if (lastStart !== -1) {
    const repaired = repairJSON(cleaned.slice(lastStart));
    try {
      JSON.parse(repaired);
      return repaired;
    } catch { /* Fail */ }
  }

  return null;
}

/**
 * Extracts blocks from any AI response format:
 * - Proper JSON array: [{...}, {...}]
 * - Single JSON object: {...} → wrapped in [...]
 * - Wrapper object: {"blocks": [...]} → inner array extracted
 * - Multiple separate objects scattered in text → collected into [...]
 * This is the last line of defense against format non-compliance.
 */
function extractBlocks(text: string): ValidBlock[] | null {
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();

  // Strategy 1: top-level JSON array
  const arrStr = extractJSON(cleaned, "[");
  if (arrStr) {
    try {
      const parsed = JSON.parse(arrStr);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as ValidBlock[];
    } catch { /* fall through */ }
  }

  // Strategy 2: single or wrapper JSON object
  const objStr = extractJSON(cleaned, "{");
  if (objStr) {
    try {
      const parsed = JSON.parse(objStr) as Record<string, unknown>;
      // Direct block object
      if (typeof parsed.type === "string" && VALID_TYPES.has(parsed.type)) {
        return [parsed] as ValidBlock[];
      }
      // Wrapper: { blocks: [...] } or { data: [...] } etc.
      for (const val of Object.values(parsed)) {
        if (Array.isArray(val) && val.length > 0 &&
            val[0] && typeof val[0] === "object" &&
            typeof (val[0] as Record<string, unknown>).type === "string") {
          return val as ValidBlock[];
        }
      }
    } catch { /* fall through */ }
  }

  // Strategy 3: collect every top-level {…} that looks like a block
  const blocks: ValidBlock[] = [];
  let pos = 0;
  while ((pos = cleaned.indexOf("{", pos)) !== -1) {
    let depth = 0; let inStr = false; let esc = false; let end = -1;
    for (let i = pos; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) break;
    const candidate = cleaned.slice(pos, end + 1);
    try {
      const obj = JSON.parse(candidate) as Record<string, unknown>;
      if (typeof obj.type === "string" && VALID_TYPES.has(obj.type)) {
        blocks.push(obj as ValidBlock);
      }
    } catch { /* skip invalid */ }
    pos = end + 1;
  }
  if (blocks.length > 0) return blocks;

  return null;
}

function ensureUniqueIds(blocks: ValidBlock[]): ValidBlock[] {
  const seenIds = new Set<string>();
  return blocks.map((b) => {
    const id = typeof b.id === "string" && b.id.length > 0 ? b.id : nanoid(8);
    if (seenIds.has(id)) {
      const newId = nanoid(8);
      seenIds.add(newId);
      return { ...b, id: newId };
    }
    seenIds.add(id);
    return { ...b, id };
  });
}

function defaultColorScheme(type?: string): PlanResult["colorScheme"] {
  const schemes: Record<string, PlanResult["colorScheme"]> = {
    portfolio:  { primary: "#8b5cf6", secondary: "#7c3aed", background: "#09090b", text: "#fafafa", accent: "#a78bfa" },
    ecommerce:  { primary: "#f97316", secondary: "#ea580c", background: "#0c0a09", text: "#fafaf9", accent: "#fb923c" },
    saas:       { primary: "#6366f1", secondary: "#4f46e5", background: "#030712", text: "#f9fafb", accent: "#818cf8" },
    blog:       { primary: "#0ea5e9", secondary: "#0284c7", background: "#0c1a2e", text: "#f0f9ff", accent: "#38bdf8" },
    restaurant: { primary: "#d97706", secondary: "#b45309", background: "#1c1917", text: "#fafaf9", accent: "#fbbf24" },
    agency:     { primary: "#ec4899", secondary: "#db2777", background: "#09090b", text: "#fafafa", accent: "#f9a8d4" },
    landing:    { primary: "#3b82f6", secondary: "#1d4ed8", background: "#0f172a", text: "#f1f5f9", accent: "#60a5fa" },
    event:      { primary: "#f97316", secondary: "#c2410c", background: "#0f172a", text: "#f9fafb", accent: "#fdba74" },
    education:  { primary: "#0ea5e9", secondary: "#0284c7", background: "#f0f9ff", text: "#0c4a6e", accent: "#38bdf8" },
    personal:   { primary: "#14b8a6", secondary: "#0d9488", background: "#09090b", text: "#fafafa", accent: "#5eead4" },
  };
  return schemes[type || ""] || schemes.landing;
}

function buildFallbackPlan(
  prompt: string,
  discovery?: DiscoveryResult | null,
  pageRole: PageRole = "home"
): PlanResult {
  const lower = prompt.toLowerCase();
  const wt = discovery?.websiteType;
  const cs = defaultColorScheme(wt);

  if (pageRole === "about") {
    return {
      intent: "About page — story, credibility, and connection (not a homepage clone)",
      style: "Warm editorial sections with clear typography; distinct from landing hero",
      blocks: ["navbar", "hero", "heading", "text", "features", "experience-timeline", "stats", "social-links", "footer"],
      colorScheme: cs,
    };
  }
  if (pageRole === "contact") {
    return {
      intent: "Contact page — form, location, and trust cues",
      style: "Clean conversion-focused layout; minimal marketing hero",
      blocks: ["navbar", "hero", "contact-form", "map", "social-links", "faq", "footer"],
      colorScheme: cs,
    };
  }
  if (pageRole === "projects") {
    return {
      intent: "Projects / work showcase page",
      style: "Case-study forward layout with strong visuals",
      blocks: ["navbar", "hero", "project-card", "stats", "cta", "footer"],
      colorScheme: cs,
    };
  }
  if (pageRole === "services") {
    return {
      intent: "Services page — offerings and process",
      style: "Service-led grid with proof and CTA",
      blocks: ["navbar", "hero", "service-card", "process-steps", "testimonials", "cta", "contact-form", "footer"],
      colorScheme: cs,
    };
  }
  if (pageRole === "pricing") {
    return {
      intent: "Pricing page — plans and comparison",
      style: "Trustworthy comparison-first layout",
      blocks: ["navbar", "hero", "pricing-table", "comparison-table", "faq", "cta", "footer"],
      colorScheme: cs,
    };
  }
  if (pageRole === "legal") {
    return {
      intent: "Legal / policy page — readable text",
      style: "Minimal, document-style readability",
      blocks: ["navbar", "heading", "text", "divider", "text", "footer"],
      colorScheme: cs,
    };
  }

  // Use discovery data first
  if (discovery?.mustHaveBlocks?.length) {
    const blocks = discovery.mustHaveBlocks.filter((b) => VALID_TYPES.has(b));
    const reordered: string[] = [];
    if (blocks.includes("navbar")) reordered.push("navbar");
    reordered.push(...blocks.filter((b) => b !== "navbar" && b !== "footer"));
    if (blocks.includes("footer")) reordered.push("footer");

    if (reordered.length >= 4) {
      return {
        intent: `Build a ${discovery.profession || discovery.websiteType} website`,
        style: discovery.designStyle || "modern dark with vibrant gradients",
        blocks: reordered,
        colorScheme: defaultColorScheme(discovery.websiteType),
      };
    }
  }

  // Keyword-based fallback
  const isPortfolio = /portfolio|freelance|designer|developer|photographer|creative|resume/.test(lower);
  const isEcommerce = /shop|store|product|ecommerce|cart/.test(lower);
  const isRestaurant = /restaurant|food|cafe|menu|dining|bakery|pizza|sushi|bar\b/.test(lower);
  const isSaas = /saas|software|app|startup|platform|tool/.test(lower);
  const isBlog = /blog|article|news|magazine/.test(lower);
  const isEvent = /event|conference|summit|meetup|workshop|hackathon|webinar|concert|festival/.test(lower);
  const isEducation = /education|course|learning|school|university|academy|tutorial|training|teach/.test(lower);
  const isPersonal = /personal|resume|cv|about me|my website|individual/.test(lower);
  const isAgency = /agency|studio|firm|consultancy|digital agency/.test(lower);
  const isFitness = /fitness|gym|workout|trainer|yoga|pilates|crossfit/.test(lower);
  const isMedical = /medical|doctor|clinic|hospital|health|dental|therapy|wellness/.test(lower);

  if (isPortfolio) return {
    intent: `Build a professional portfolio website`,
    style: "modern dark with purple gradients, glassmorphism cards, and smooth animations",
    blocks: ["navbar", "hero", "skills-grid", "project-card", "experience-timeline", "testimonials", "contact-form", "social-links", "footer"],
    colorScheme: defaultColorScheme("portfolio"),
  };
  if (isEcommerce) return {
    intent: `Build a conversion-optimized ecommerce store`,
    style: "vibrant with high-contrast orange, warm tones, and clean product layout",
    blocks: ["navbar", "hero", "banner", "product-card", "features", "testimonials", "stats", "newsletter", "footer"],
    colorScheme: defaultColorScheme("ecommerce"),
  };
  if (isRestaurant) return {
    intent: `Build an appetizing restaurant website`,
    style: "warm amber tones, food photography emphasis, inviting and welcoming",
    blocks: ["navbar", "hero", "features", "gallery", "menu-grid", "stats", "testimonials", "map", "booking-form", "footer"],
    colorScheme: defaultColorScheme("restaurant"),
  };
  if (isSaas) return {
    intent: `Build a SaaS product landing page`,
    style: "clean dark with electric blue/indigo accents, trustworthy and modern",
    blocks: ["navbar", "hero", "logo-cloud", "features", "process-steps", "stats", "pricing-table", "comparison-table", "testimonials", "faq", "cta", "footer"],
    colorScheme: defaultColorScheme("saas"),
  };
  if (isEvent) return {
    intent: `Build an engaging event/conference landing page`,
    style: "bold energetic with orange and deep purple, dynamic and urgent",
    blocks: ["navbar", "hero", "countdown", "features", "event-schedule", "team", "pricing-table", "stats", "testimonials", "booking-form", "footer"],
    colorScheme: defaultColorScheme("event"),
  };
  if (isEducation) return {
    intent: `Build an education/course platform website`,
    style: "clean approachable sky-blue/teal, educational and trustworthy",
    blocks: ["navbar", "hero", "features", "course-card", "stats", "testimonials", "pricing-table", "cta", "newsletter", "footer"],
    colorScheme: defaultColorScheme("education"),
  };
  if (isPersonal) return {
    intent: `Build a personal website / online resume`,
    style: "dark sleek with teal accent, professional but memorable",
    blocks: ["navbar", "hero", "skills-grid", "project-card", "experience-timeline", "stats", "contact-form", "social-links", "footer"],
    colorScheme: defaultColorScheme("personal"),
  };
  if (isAgency) return {
    intent: `Build a creative agency landing page`,
    style: "bold confident with magenta/purple, modern dark or stark white",
    blocks: ["navbar", "hero", "logo-cloud", "service-card", "process-steps", "team", "stats", "testimonials", "cta", "footer"],
    colorScheme: defaultColorScheme("agency"),
  };
  if (isFitness) return {
    intent: `Build a bold fitness/gym website`,
    style: "bold dark with neon red/green accents, energetic and powerful",
    blocks: ["navbar", "hero", "features", "pricing-table", "team", "gallery", "stats", "testimonials", "booking-form", "footer"],
    colorScheme: { primary: "#ef4444", secondary: "#dc2626", background: "#09090b", text: "#fafafa", accent: "#10b981" },
  };
  if (isMedical) return {
    intent: `Build a trustworthy medical/health website`,
    style: "clean calming blue-green, professional and reassuring",
    blocks: ["navbar", "hero", "features", "team", "stats", "testimonials", "booking-form", "map", "footer"],
    colorScheme: { primary: "#0d9488", secondary: "#0f766e", background: "#f0fdfa", text: "#134e4a", accent: "#14b8a6" },
  };
  if (isBlog) return {
    intent: `Build a blog or content website`,
    style: "clean sky-blue tones, content-first readable layout",
    blocks: ["navbar", "hero", "blog-list", "newsletter", "footer"],
    colorScheme: defaultColorScheme("blog"),
  };

  return {
    intent: `Build a compelling website`,
    style: "modern dark with vibrant blue gradients and smooth animations",
    blocks: ["navbar", "hero", "features", "stats", "testimonials", "cta", "footer"],
    colorScheme: defaultColorScheme("landing"),
  };
}

function buildSummaryMessage(blockCount: number, tasks: AgentTask[]): string {
  const phases = tasks.map((t) => {
    const icon = t.status === "done" ? "✅" : t.status === "failed" ? "❌" : "⏳";
    const who = t.providerName || t.phase;
    return `${icon} ${who}`;
  });
  return `Generated ${blockCount} blocks.\nPipeline: ${phases.join(" → ")}`;
}
