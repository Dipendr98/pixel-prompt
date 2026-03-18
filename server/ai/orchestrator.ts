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

import { callWithFallback } from "./providers.js";
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
  websiteType: "portfolio" | "ecommerce" | "saas" | "blog" | "restaurant" | "agency" | "landing" | "other";
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
]);

// ── PHASE 0: Discovery Prompt ─────────────────────────────────────────────────
// Forces the model to reason step-by-step through every dimension of the request.

const DISCOVERY_SYSTEM = `<role>
You are a world-class website strategist and digital consultant for PixelPrompt.
You think deeply before acting. You consider EVERY possibility about what the user is building,
who it is for, what will make it succeed, and what the user likely forgot to mention.
</role>

<task>
Analyze the user's request using deep, structured reasoning. Consider all possibilities.
Return ONLY a valid JSON object — no markdown, no code fences, no explanation.
</task>

<reasoning_process>
Before outputting, think through these dimensions in order:

STEP 1 — DECODE THE REQUEST
  What exactly is this person building? What type? What sub-type?
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
  "websiteType": "portfolio|ecommerce|saas|blog|restaurant|agency|landing|other",
  "subType": "specific sub-type e.g. developer|designer|photographer|consultant|startup|fashion|food|fitness",
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
  "personalization": "Extracted name, specialty, tech stack, company, or any personal detail"
}
</output_schema>

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
1. BLOCKS: 6–9 items. Every block must serve the page's goal. No filler.
2. ORDER: navbar (if needed) → hero → proof/features → work/products → testimonials/stats → conversion → footer
3. COLORS: Use VIBRANT, MEMORABLE palettes. Think Stripe, Linear, Vercel, Figma — not your bank's website.
   - Developer/tech: Deep dark + neon green/cyan/violet (#10b981, #06b6d4, #8b5cf6)
   - Designer: Rich purples + pinks or bold orange/yellow (#f97316, #ec4899, #a855f7)
   - Photographer: Near-black or pure white, single accent color (#111827, #f9fafb, #d97706)
   - SaaS: Deep navy/slate + electric blue/indigo (#3b82f6, #6366f1, #0ea5e9)
   - Restaurant: Warm amber/red/golden (#d97706, #ef4444, #f59e0b)
   - Ecommerce: High-contrast orange or green (#f97316, #16a34a)
4. PORTFOLIO: ALWAYS include project-card (shows work), skills-grid (shows expertise). These are NON-NEGOTIABLE for any portfolio.
5. NARRATIVE: The page should flow like a story. Start with "who I am/what we do", build trust, show proof, then convert.
</design_rules>

<available_blocks>
hero, navbar, footer, features, testimonials, pricing-table, stats, team, gallery,
faq, contact-form, newsletter, logo-cloud, cta, banner, heading, text, button,
image, divider, spacer, countdown, product-card, social-links, video,
blog-post, blog-list, cart, checkout-form, map, booking-form, login-form,
project-card, experience-timeline, skills-grid
</available_blocks>`;

// ── PHASE 2: Coder Prompt ─────────────────────────────────────────────────────
// Generates deeply specific, professional, industry-aware content.

const CODER_SYSTEM = `<role>
Expert UI component generator for PixelPrompt. You don't write placeholder content.
You write REAL content — specific job titles, real-sounding project names, actual skill names,
convincing testimonials with specific roles. Every block should look like it was made for a real person.
</role>

<task>
Generate a JSON array of website blocks following the plan exactly.
Return ONLY a minified JSON array starting with [ and ending with ] — nothing else.
NO markdown, NO code fences, NO explanation.
</task>

<block_format>
{"id":"8charstr","type":"blockType","props":{...},"style":{"backgroundColor":"#hex","textColor":"#hex","padding":"px","borderRadius":"px","animation":"slide-up","animationDuration":"0.8","animationDelay":"0.2"}}
</block_format>

<non_negotiable_rules>
1. UNIQUE IDs: Every block needs a unique 8-character alphanumeric id.
2. FOLLOW THE COLOR SCHEME EXACTLY. Dark bg + light text for dark themes. NEVER white bg with white text.
3. EVERY BLOCK must have style with backgroundColor AND textColor. Alternate section backgrounds to create visual rhythm.
4. ANIMATIONS: Every block must have style.animation from: fade-in, slide-up, slide-down, slide-left, slide-right, zoom-in, zoom-out, flip, bounce. Set animationDuration (0.5–1.0) and animationDelay (0–0.5).
5. NO EMPTY PROPS. Every field must have real, specific, professional content.
6. IMAGES: Use real Unsplash URLs. Match image content to context. Examples:
   - Developer: https://images.unsplash.com/photo-1555099962-4199c345e5dd?auto=format&fit=crop&w=800&q=80
   - Designer: https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80
   - Restaurant food: https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80
   - Product/store: https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80
   - Team/people: https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=800&q=80
   - Abstract/tech: https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80
7. SECTION COLOR RHYTHM: Alternate colors between sections (dark → slightly lighter dark → dark) for a premium layered look.
</non_negotiable_rules>

<content_standards>
HERO:
  - title: Specific, punchy headline. For portfolios: "Full Stack Developer Crafting Scalable Web Apps" not "Hello World"
  - subtitle: 1-2 sentences with specific value proposition. Include tech stack or specialty if portfolio.
  - buttonText: Action-oriented ("View My Work", "See Projects", "Shop Now", "Start Free Trial")

FEATURES:
  - title: Specific feature name matching the product/service
  - desc: 2-3 sentences explaining the actual benefit and HOW it helps
  - At least 3 features. For SaaS: 6 features.

PROJECT-CARD (portfolios ONLY):
  - Generate exactly 3 impressive projects
  - title: Real-sounding project names ("TaskFlow SaaS", "NovaPay Payment Gateway", "EcoShop Marketplace")
  - description: 2 sentences: what it does + the impact/result ("Reduced checkout time by 40%", "Serves 10k+ users")
  - techStack: 3-5 actual technologies matching the developer's stack
  - liveUrl, repoUrl: Use "#" — NEVER leave empty

EXPERIENCE-TIMELINE:
  - Generate 3-4 entries with progression (junior → senior or education → senior)
  - company: Real-sounding company names ("Accenture", "Meta", "FinTech Startup", "Digital Agency XYZ")
  - period: Consistent format "Jan 2020 – Present" or "2018 – 2022"
  - description: 2 sentences with specific responsibilities and achievements. Include numbers where possible.

SKILLS-GRID:
  - 8-12 skills. Match the profession. DO NOT use generic "Skill 1".
  - level: Realistic percentages. Senior skills: 85-95. Good skills: 70-85. Learning: 55-70.
  - icon: "code" for languages/frameworks, "design" for design tools, "cloud" for AWS/GCP/Azure,
         "data" for databases/ML, "mobile" for iOS/Android, "devops" for Docker/CI/CD

TESTIMONIALS:
  - Real-sounding names with specific roles and companies ("Sarah Chen, VP of Engineering at Stripe")
  - Quotes mention specific outcomes and results ("increased our team velocity by 3x", "delivered ahead of schedule")

STATS:
  - Credible, impressive but believable numbers
  - Match the field: Portfolio → "47 Projects Delivered", "5 Years Experience"
  - SaaS → "99.9% Uptime", "10k+ Users", "$2M Revenue Saved"

PRICING-TABLE:
  - Realistic price points for the industry
  - Free/Starter/Pro/Enterprise structure
  - Features must be SPECIFIC to the actual product

BLOG-LIST:
  - 3 posts with industry-relevant titles, not "Blog Post 1"
  - Proper categories matching the website's field

FOOTER:
  - Real column structure: Company, Product, Resources, Legal
  - 3-5 links per column, all relevant
  - Copyright with the actual current year and company/name
</content_standards>

<block_props>
- hero: {title, subtitle, buttonText}
- navbar: {brand, links:[{label,url}], ctaText}
- footer: {columns:[{title,links:[string]}], copyright}
- features: {features:[{title,desc}]}
- testimonials: {testimonials:[{name,role,quote}]}
- pricing-table: {plans:[{name,price,features:[string],highlighted:boolean}]}
- stats: {stats:[{value,label}]}
- team: {members:[{name,role,bio,image}]}
- gallery: {images:[{src,alt}]}
- faq: {title,items:[{question,answer}]}
- contact-form: {title,subtitle,buttonText}
- newsletter: {title,subtitle,buttonText}
- logo-cloud: {title,logos:[string]}
- cta: {title,subtitle,primaryButton,secondaryButton}
- banner: {text,variant:"info"|"warning"|"error"}
- heading: {text,align:"left"|"center"|"right"}
- text: {text,align:"left"|"center"|"right"}
- button: {text,url,align:"left"|"center"|"right"}
- image: {src,alt,height}
- divider: {}
- spacer: {height}
- countdown: {title,subtitle,targetDate}
- product-card: {products:[{name,price,description,image}]}
- social-links: {links:[{platform,url}]}
- video: {url,height}
- blog-post: {title,excerpt,author,date,category,image}
- blog-list: {title,posts:[{title,excerpt,author,date,category}]}
- cart: {items:[{name,price,quantity}],showCheckout:boolean}
- checkout-form: {title,subtitle,buttonText}
- map: {address,zoom,height}
- booking-form: {title,subtitle,buttonText,services:[string]}
- login-form: {title,subtitle,buttonText,showSignup:boolean}
- project-card: {title,projects:[{title,description,image,techStack:[string],liveUrl,repoUrl}]}
- experience-timeline: {title,items:[{title,company,period,description}]}
- skills-grid: {title,skills:[{name,level,icon:"code"|"design"|"cloud"|"data"|"mobile"|"devops"}]}
</block_props>`;

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

CONTENT QUALITY:
✓ No placeholder text: "Feature 1", "Lorem ipsum", "Company A", "Your Title", "Skill 1" etc.
  → Replace with specific, realistic, professional content matching the website type
✓ Hero title must be specific and compelling — not generic
✓ All testimonials must have full names + specific roles + convincing quotes with outcomes
✓ All stats must be credible and impressive for the industry
✓ Footer copyright must include a real year (2025) and company/person name

PORTFOLIO BLOCKS (if present):
✓ project-card.projects must be an array of 3 items with all fields filled
  → Each must have title (real project name), description (2 sentences with impact),
  → techStack (3-5 items), liveUrl, repoUrl — NEVER empty arrays
✓ experience-timeline.items must have 3+ entries with specific companies and periods
✓ skills-grid.skills must have 8+ entries, all with level (0-100) and valid icon type
  → icon must be one of: "code", "design", "cloud", "data", "mobile", "devops"

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
  onProgress?: ProgressCallback
): Promise<OrchestrationResult> {
  const emit = (event: ProgressEvent) => onProgress?.(event);
  const tasks: AgentTask[] = [];

  // ── Phase 0: Discovery ────────────────────────────────────────────────────
  let discovery: DiscoveryResult | null = null;

  const discoverTask: AgentTask = {
    id: nanoid(8),
    phase: "discover",
    description: "Think through every dimension: audience, goal, narrative, required blocks",
    status: "running",
  };
  tasks.push(discoverTask);

  emit({ type: "phase_start", phase: "discover", message: "🔎 Analyzing every dimension of your request..." });
  emit({ type: "task_update", task: discoverTask });

  try {
    const { content: raw, providerName, model } = await callWithFallback(
      "planner",
      [
        { role: "system", content: DISCOVERY_SYSTEM },
        { role: "user", content: prompt },
      ],
      { temperature: 0.15, maxTokens: 1200, topP: 0.9 }
    );

    discoverTask.providerName = providerName;
    discoverTask.model = model;

    const jsonStr = extractJSON(raw, "{");
    if (jsonStr) {
      discovery = JSON.parse(jsonStr) as DiscoveryResult;
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
    } else {
      throw new Error("No JSON in discovery response");
    }
  } catch (err: any) {
    discoverTask.status = "failed";
    discoverTask.error = err.message;
    emit({ type: "task_update", task: discoverTask });
    emit({ type: "log", message: `⚠️ Discovery skipped (${err.message}), proceeding with direct planning` });
  }

  // ── Phase 1: Planner ──────────────────────────────────────────────────────
  const planTask: AgentTask = {
    id: nanoid(8),
    phase: "plan",
    description: "Architect page flow — choose blocks that tell a story",
    status: "running",
  };
  tasks.push(planTask);

  emit({ type: "phase_start", phase: "plan", message: "🧠 Architecting the perfect page structure..." });
  emit({ type: "task_update", task: planTask });

  let plan: PlanResult;

  try {
    const discoveryCtx = discovery
      ? buildDiscoveryContext(discovery)
      : "";

    const plannerMsg = `${discoveryCtx}

<user_request>${prompt}</user_request>

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
    plan = buildFallbackPlan(prompt, discovery);
  }

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
    message: `⚡ Generating ${plan.blocks.length} blocks with real content...`,
  });
  emit({ type: "task_update", task: codeTask });

  let rawBlocks: ValidBlock[] = [];

  try {
    const personalization = discovery
      ? `\n<personalization>
Person: ${discovery.profession}${discovery.personalization ? ` — ${discovery.personalization}` : ""}
Audience: ${discovery.targetAudience}
Content tone: ${discovery.contentTone}
Generate content that is authentic, specific, and tailored to this exact profile. No generic placeholders.
</personalization>`
      : "";

    const coderMsg = `<plan>
<intent>${plan.intent}</intent>
<style>${plan.style}</style>
<color_scheme>${JSON.stringify(plan.colorScheme)}</color_scheme>
<blocks_in_order>${plan.blocks.join(", ")}</blocks_in_order>
</plan>
${personalization}
<user_request>${prompt}</user_request>

Generate the complete blocks JSON array for these block types in EXACTLY this order: ${plan.blocks.join(", ")}

Remember: Every piece of text, every number, every name must feel REAL and SPECIFIC to this exact website.`;

    const { content: raw, providerName, model } = await callWithFallback(
      "coder",
      [
        { role: "system", content: CODER_SYSTEM },
        { role: "user", content: coderMsg },
      ],
      { temperature: 0.65, maxTokens: 8192, topP: 0.95 }
    );

    codeTask.providerName = providerName;
    codeTask.model = model;

    const jsonStr = extractJSON(raw, "[");
    if (!jsonStr) {
      console.error("CODER RAW (first 2000 chars):", raw.slice(0, 2000));
      throw new Error("Coder response contained no JSON array");
    }

    const parsed = JSON.parse(jsonStr) as unknown[];
    rawBlocks = parsed.filter(
      (b): b is ValidBlock =>
        b !== null &&
        typeof b === "object" &&
        "type" in b &&
        typeof (b as any).type === "string" &&
        VALID_TYPES.has((b as any).type)
    );

    if (rawBlocks.length === 0) throw new Error("No valid blocks in coder response");

    rawBlocks = ensureUniqueIds(rawBlocks);

    codeTask.status = "done";
    codeTask.result = { blockCount: rawBlocks.length };

    emit({
      type: "phase_end",
      phase: "code",
      message: `✅ ${rawBlocks.length} blocks generated (${providerName} ${model})`,
    });
    emit({ type: "task_update", task: codeTask });
  } catch (err: any) {
    codeTask.status = "failed";
    codeTask.error = err.message;
    emit({ type: "task_update", task: codeTask });
    emit({ type: "error", message: `❌ Coder failed: ${err.message}`, fatal: true });
    throw err;
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

function buildDiscoveryContext(d: DiscoveryResult): string {
  return `<discovery_analysis>
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

function extractJSON(text: string, startChar: "{" | "["): string | null {
  const endChar = startChar === "{" ? "}" : "]";
  const start = text.indexOf(startChar);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === startChar) depth++;
    else if (ch === endChar) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
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
  };
  return schemes[type || ""] || schemes.landing;
}

function buildFallbackPlan(prompt: string, discovery?: DiscoveryResult | null): PlanResult {
  const lower = prompt.toLowerCase();

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
  const isRestaurant = /restaurant|food|cafe|menu|dining/.test(lower);
  const isSaas = /saas|software|app|startup|platform|tool/.test(lower);
  const isBlog = /blog|article|news|magazine/.test(lower);

  if (isPortfolio) return {
    intent: `Build a professional portfolio website`,
    style: "modern dark with purple gradients, glassmorphism cards, and smooth animations",
    blocks: ["navbar", "hero", "skills-grid", "project-card", "experience-timeline", "testimonials", "contact-form", "footer"],
    colorScheme: defaultColorScheme("portfolio"),
  };
  if (isEcommerce) return {
    intent: `Build a conversion-optimized ecommerce store`,
    style: "vibrant with high-contrast orange, warm tones, and clean product layout",
    blocks: ["navbar", "hero", "banner", "product-card", "features", "testimonials", "newsletter", "footer"],
    colorScheme: defaultColorScheme("ecommerce"),
  };
  if (isRestaurant) return {
    intent: `Build an appetizing restaurant website`,
    style: "warm amber tones, food photography emphasis, inviting and welcoming",
    blocks: ["navbar", "hero", "features", "gallery", "stats", "testimonials", "map", "contact-form", "footer"],
    colorScheme: defaultColorScheme("restaurant"),
  };
  if (isSaas) return {
    intent: `Build a SaaS product landing page`,
    style: "clean dark with electric blue/indigo accents, trustworthy and modern",
    blocks: ["navbar", "hero", "logo-cloud", "features", "pricing-table", "testimonials", "faq", "cta", "footer"],
    colorScheme: defaultColorScheme("saas"),
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
