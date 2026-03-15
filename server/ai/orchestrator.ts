/**
 * Multi-Agent Orchestrator — PixelPrompt
 *
 * Pipeline: Planner (Groq Llama 3.3 70B)
 *         → Coder  (NVIDIA DeepSeek V3)
 *         → Reviewer (GitHub GPT-4o-mini)
 *
 * Inspired by Replit Agent architecture:
 *   - XML-structured prompts for reliable model understanding
 *   - Context compression between phases
 *   - Tool DSL for block generation
 *   - Self-healing fallback chain
 */

import { callWithFallback } from "./providers.js";
import { nanoid } from "nanoid";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentTask {
  id: string;
  phase: "plan" | "code" | "review";
  description: string;
  status: "pending" | "running" | "done" | "failed";
  providerName?: string;
  model?: string;
  result?: Record<string, unknown>;
  error?: string;
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

type ValidBlock = {
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
  "login-form", "section",
]);

// ── System prompts (XML-structured for reliable parsing) ──────────────────────

const PLANNER_SYSTEM = `<role>Expert UI architect for PixelPrompt, a drag-and-drop website builder.</role>

<task>
Analyze the user's prompt and produce a structured plan for the website layout.
Return ONLY a valid JSON object — no markdown, no code fences, no explanation.
</task>

<output_schema>
{
  "intent": "one sentence describing what to build",
  "style": "design direction e.g. 'modern dark with purple gradients and glassmorphism'",
  "blocks": ["block_type1", "block_type2"],
  "colorScheme": {
    "primary": "#hex",
    "secondary": "#hex",
    "background": "#hex",
    "text": "#hex",
    "accent": "#hex"
  }
}
</output_schema>

<constraints>
- "blocks" array: 5–8 items max, ordered logically (navbar first if present, footer last)
- Choose blocks that best serve the use-case — don't include irrelevant blocks
- Use vibrant, modern color schemes with high contrast
- Colors must be valid hex codes
</constraints>

<available_blocks>
hero, navbar, footer, features, testimonials, pricing-table, stats, team, gallery,
faq, contact-form, newsletter, logo-cloud, cta, banner, heading, text, button,
image, divider, spacer, countdown, product-card, social-links, video,
blog-post, blog-list, cart, checkout-form, map, booking-form, login-form
</available_blocks>`;

const CODER_SYSTEM = `<role>Expert UI component generator for PixelPrompt website builder.</role>

<task>
Generate a JSON array of website blocks following the plan exactly.
Return ONLY a minified JSON array starting with [ and ending with ] — nothing else.
</task>

<block_format>
{"id":"8charstr","type":"blockType","props":{...},"style":{"backgroundColor":"#hex","textColor":"#hex","padding":"px","borderRadius":"px","customCss":"animation css"}}
</block_format>

<rules>
1. IDs must be unique 8-character alphanumeric strings
2. Follow the plan's color scheme exactly
3. Every block MUST have a style object with backgroundColor and textColor
4. Add CSS entrance animations via style.customCss (e.g. "animation:slideUp 0.7s ease forwards;opacity:0;")
5. Keep all text copy punchy and professional (8-12 words max per field)
6. NO markdown, NO code fences, NO explanation — just the raw JSON array
</rules>

<block_props>
- hero: {title, subtitle, buttonText}
- navbar: {brand, links:[{label,url}], ctaText}
- footer: {columns:[{title,links:[string]}], copyright}
- features: {features:[{title,desc}]}
- testimonials: {testimonials:[{name,role,quote}]}
- pricing-table: {plans:[{name,price,features:[string],highlighted:boolean}]}
- stats: {stats:[{value,label}]}
- team: {members:[{name,role,bio}]}
- gallery: {count:number}
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
</block_props>`;

const REVIEWER_SYSTEM = `<role>Senior UI quality reviewer for PixelPrompt website builder.</role>

<task>
Review the generated blocks JSON. Fix any issues found. Return the corrected JSON array.
Return ONLY the minified JSON array — no markdown, no explanation.
</task>

<review_checklist>
1. Missing required props → fill with sensible defaults
2. Text contrast issues → ensure readable text on all backgrounds
3. Structural order → navbar must be first if present; footer must be last if present
4. Duplicate IDs → generate new unique IDs for duplicates
5. Invalid types → remove blocks with types not in the valid list
6. Content quality → ensure text is professional and context-appropriate
</review_checklist>

<important>
Do NOT add new blocks. Do NOT remove blocks unless they have invalid types.
Only fix existing blocks. If everything is correct, return unchanged.
</important>`;

// ── Orchestrator ──────────────────────────────────────────────────────────────

export async function orchestrate(
  prompt: string,
  onProgress?: ProgressCallback
): Promise<OrchestrationResult> {
  const emit = (event: ProgressEvent) => onProgress?.(event);
  const tasks: AgentTask[] = [];

  // ── Phase 1: Planner (Groq Llama 3.3 70B) ─────────────────────────────────
  const planTask: AgentTask = {
    id: nanoid(8),
    phase: "plan",
    description: "Analyze prompt and architect website structure",
    status: "running",
  };
  tasks.push(planTask);

  emit({ type: "phase_start", phase: "plan", message: "🧠 Planner (Groq Llama 3.3 70B) analyzing your request..." });
  emit({ type: "task_update", task: planTask });

  let plan: PlanResult;

  try {
    const { content: raw, providerName, model } = await callWithFallback(
      "planner",
      [
        { role: "system", content: PLANNER_SYSTEM },
        { role: "user", content: prompt },
      ],
      { temperature: 0.3, maxTokens: 1024, topP: 0.9 }
    );

    planTask.providerName = providerName;
    planTask.model = model;

    // Extract JSON object from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Planner response contained no JSON object");

    plan = JSON.parse(jsonMatch[0]) as PlanResult;

    // Validate and sanitize plan
    if (!plan.blocks || !Array.isArray(plan.blocks)) {
      plan.blocks = ["navbar", "hero", "features", "cta", "footer"];
    }
    if (!plan.colorScheme) {
      plan.colorScheme = {
        primary: "#6366f1",
        secondary: "#4f46e5",
        background: "#0f172a",
        text: "#f1f5f9",
        accent: "#a78bfa",
      };
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
    emit({ type: "log", message: `📋 ${plan.blocks.length} blocks planned: ${plan.blocks.join(", ")}` });
  } catch (err: any) {
    planTask.status = "failed";
    planTask.error = err.message;
    emit({ type: "task_update", task: planTask });
    emit({ type: "log", message: `⚠️ Planner failed (${err.message}), using fallback plan` });

    // Intelligent fallback plan based on prompt keywords
    plan = buildFallbackPlan(prompt);
  }

  // ── Phase 2: Coder (NVIDIA DeepSeek V3) ───────────────────────────────────
  const codeTask: AgentTask = {
    id: nanoid(8),
    phase: "code",
    description: `Generate ${plan.blocks.length} blocks: ${plan.blocks.join(", ")}`,
    status: "running",
  };
  tasks.push(codeTask);

  emit({
    type: "phase_start",
    phase: "code",
    message: `⚡ Coder (NVIDIA DeepSeek V3) generating ${plan.blocks.length} blocks...`,
  });
  emit({ type: "task_update", task: codeTask });

  let rawBlocks: ValidBlock[] = [];

  try {
    const coderUserMsg = `<plan>
<intent>${plan.intent}</intent>
<style>${plan.style}</style>
<blocks_required>${plan.blocks.join(", ")}</blocks_required>
<color_scheme>${JSON.stringify(plan.colorScheme)}</color_scheme>
</plan>

<user_request>
${prompt}
</user_request>

Generate the complete blocks JSON array. Include exactly these block types in this order: ${plan.blocks.join(", ")}`;

    const { content: raw, providerName, model } = await callWithFallback(
      "coder",
      [
        { role: "system", content: CODER_SYSTEM },
        { role: "user", content: coderUserMsg },
      ],
      { temperature: 0.7, maxTokens: 8192, topP: 0.95 }
    );

    codeTask.providerName = providerName;
    codeTask.model = model;

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Coder response contained no JSON array");

    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    rawBlocks = parsed.filter(
      (b): b is ValidBlock =>
        b !== null &&
        typeof b === "object" &&
        "type" in b &&
        typeof (b as any).type === "string" &&
        VALID_TYPES.has((b as any).type)
    );

    if (rawBlocks.length === 0) throw new Error("No valid blocks in coder response");

    // Ensure unique IDs
    const seenIds = new Set<string>();
    rawBlocks = rawBlocks.map((b) => {
      const id = typeof b.id === "string" && b.id.length > 0 ? b.id : nanoid(8);
      if (seenIds.has(id)) {
        const newId = nanoid(8);
        seenIds.add(newId);
        return { ...b, id: newId };
      }
      seenIds.add(id);
      return { ...b, id };
    });

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

  // ── Phase 3: Reviewer (GitHub GPT-4o-mini) ─────────────────────────────────
  const reviewTask: AgentTask = {
    id: nanoid(8),
    phase: "review",
    description: `Validate & polish ${rawBlocks.length} blocks`,
    status: "running",
  };
  tasks.push(reviewTask);

  emit({
    type: "phase_start",
    phase: "review",
    message: `🔍 Reviewer (GitHub GPT-4o-mini) validating ${rawBlocks.length} blocks...`,
  });
  emit({ type: "task_update", task: reviewTask });

  let finalBlocks = rawBlocks;

  try {
    const reviewUserMsg = `<context>
User request: ${prompt}
Intent: ${plan.intent}
Color scheme: ${JSON.stringify(plan.colorScheme)}
</context>

<blocks_to_review>
${JSON.stringify(rawBlocks)}
</blocks_to_review>

Review and fix the blocks following the checklist. Return the corrected JSON array.`;

    const { content: raw, providerName, model } = await callWithFallback(
      "reviewer",
      [
        { role: "system", content: REVIEWER_SYSTEM },
        { role: "user", content: reviewUserMsg },
      ],
      { temperature: 0.2, maxTokens: 8192 }
    );

    reviewTask.providerName = providerName;
    reviewTask.model = model;

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const reviewed = JSON.parse(jsonMatch[0]) as unknown[];
      const validReviewed = reviewed.filter(
        (b): b is ValidBlock =>
          b !== null &&
          typeof b === "object" &&
          "type" in b &&
          VALID_TYPES.has((b as any).type)
      );

      if (validReviewed.length > 0) {
        // Ensure IDs are still unique after review
        const seenIds = new Set<string>();
        finalBlocks = validReviewed.map((b) => {
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
    }

    reviewTask.status = "done";
    reviewTask.result = { blockCount: finalBlocks.length };

    emit({
      type: "phase_end",
      phase: "review",
      message: `✅ Review complete (${providerName}): ${finalBlocks.length} blocks ready`,
    });
    emit({ type: "task_update", task: reviewTask });
  } catch (err: any) {
    // Reviewer failure is non-fatal — use coder output as-is
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFallbackPlan(prompt: string): PlanResult {
  const lower = prompt.toLowerCase();

  const isEcommerce = /shop|store|product|ecommerce|cart/.test(lower);
  const isRestaurant = /restaurant|food|cafe|menu|dining/.test(lower);
  const isPortfolio = /portfolio|freelance|designer|photographer|creative/.test(lower);
  const isSaas = /saas|software|app|startup|platform|tool/.test(lower);
  const isBlog = /blog|article|news|magazine|post/.test(lower);

  let blocks: string[];
  let colorScheme: PlanResult["colorScheme"];

  if (isEcommerce) {
    blocks = ["navbar", "hero", "banner", "product-card", "features", "testimonials", "newsletter", "footer"];
    colorScheme = { primary: "#f97316", secondary: "#ea580c", background: "#0c0a09", text: "#fafaf9", accent: "#fb923c" };
  } else if (isRestaurant) {
    blocks = ["navbar", "hero", "features", "product-card", "stats", "gallery", "testimonials", "contact-form", "footer"];
    colorScheme = { primary: "#d97706", secondary: "#b45309", background: "#1c1917", text: "#fafaf9", accent: "#fbbf24" };
  } else if (isPortfolio) {
    blocks = ["navbar", "hero", "logo-cloud", "gallery", "features", "testimonials", "cta", "footer"];
    colorScheme = { primary: "#8b5cf6", secondary: "#7c3aed", background: "#09090b", text: "#fafafa", accent: "#a78bfa" };
  } else if (isSaas) {
    blocks = ["navbar", "hero", "logo-cloud", "features", "pricing-table", "testimonials", "faq", "cta", "footer"];
    colorScheme = { primary: "#6366f1", secondary: "#4f46e5", background: "#030712", text: "#f9fafb", accent: "#818cf8" };
  } else if (isBlog) {
    blocks = ["navbar", "hero", "blog-list", "newsletter", "footer"];
    colorScheme = { primary: "#0ea5e9", secondary: "#0284c7", background: "#0c1a2e", text: "#f0f9ff", accent: "#38bdf8" };
  } else {
    blocks = ["navbar", "hero", "features", "stats", "testimonials", "cta", "footer"];
    colorScheme = { primary: "#3b82f6", secondary: "#1d4ed8", background: "#0f172a", text: "#f1f5f9", accent: "#60a5fa" };
  }

  return {
    intent: `Build a ${prompt.split(" ").slice(0, 6).join(" ")} website`,
    style: "modern dark with vibrant gradients and smooth animations",
    blocks,
    colorScheme,
  };
}

function buildSummaryMessage(blockCount: number, tasks: AgentTask[]): string {
  const phases = tasks.map((t) => {
    const icon = t.status === "done" ? "✅" : t.status === "failed" ? "❌" : "⏳";
    const who = t.providerName ? `${t.providerName}` : t.phase;
    return `${icon} ${who}`;
  });

  return (
    `Multi-agent generation complete — ${blockCount} blocks.\n` +
    `Pipeline: ${phases.join(" → ")}`
  );
}
