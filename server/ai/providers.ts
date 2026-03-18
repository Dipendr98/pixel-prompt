/**
 * AI Provider abstraction layer
 * Smart fallback chain: Groq (Planner) → NVIDIA NIM (Coder) → GitHub Models (Reviewer)
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

interface ProviderConfig {
  name: string;
  displayName: string;
  baseUrl: string;
  getApiKey: () => string;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  groq: {
    name: "groq",
    displayName: "Analysis Engine",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    getApiKey: () => process.env.GROQ_API_KEY || "",
  },
  nvidia: {
    name: "nvidia",
    displayName: "Generation Engine",
    baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    getApiKey: () => process.env.NVIDIA_API_KEY || "",
  },
  github: {
    name: "github",
    displayName: "Validation Engine",
    baseUrl: "https://models.inference.ai.azure.com/chat/completions",
    getApiKey: () => process.env.GITHUB_TOKEN || "",
  },
};

// Role → primary model assignment
export const ROLE_ASSIGNMENTS = {
  planner: { provider: "groq", model: "llama-3.3-70b-versatile" },
  coder:   { provider: "nvidia", model: "deepseek-ai/deepseek-v3.2" },
  reviewer: { provider: "github", model: "gpt-4o-mini" },
  fast:    { provider: "groq", model: "llama-3.1-8b-instant" },
} as const;

// Fallback chains per role (most capable first, then degraded)
const FALLBACK_CHAINS: Record<string, Array<{ provider: string; model: string }>> = {
  planner: [
    { provider: "groq",   model: "llama-3.3-70b-versatile" },
    { provider: "nvidia", model: "deepseek-ai/deepseek-v3.2" },
    { provider: "github", model: "gpt-4o-mini" },
  ],
  coder: [
    { provider: "nvidia", model: "deepseek-ai/deepseek-v3.2" },
    { provider: "groq",   model: "llama-3.3-70b-versatile" },
    { provider: "github", model: "gpt-4o-mini" },
  ],
  reviewer: [
    { provider: "github", model: "gpt-4o-mini" },
    { provider: "groq",   model: "llama-3.3-70b-versatile" },
    { provider: "nvidia", model: "deepseek-ai/deepseek-v3.2" },
  ],
  fast: [
    { provider: "groq",   model: "llama-3.1-8b-instant" },
    { provider: "groq",   model: "llama-3.3-70b-versatile" },
  ],
};

export async function callProvider(
  providerName: string,
  model: string,
  messages: ChatMessage[],
  options: CallOptions = {}
): Promise<string> {
  const cfg = PROVIDER_CONFIGS[providerName];
  if (!cfg) throw new Error(`Unknown provider: ${providerName}`);

  const apiKey = cfg.getApiKey();
  if (!apiKey) {
    throw new Error(
      `${cfg.displayName} API key not configured. Set ${getEnvVar(providerName)} in .env`
    );
  }

  const body = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    top_p: options.topP ?? 0.95,
    stream: false,
  };

  // 120s timeout to prevent indefinite hangs on provider failures
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let response: Response;
  try {
    response = await fetch(cfg.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error(`${cfg.displayName} (${model}) timed out after 120s`);
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `${cfg.displayName} (${model}) returned ${response.status}: ${errText.slice(0, 300)}`
    );
  }

  const data = await response.json();
  const content: string =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    "";

  if (!content) throw new Error(`Empty response from ${cfg.displayName}`);

  // Strip <think>...</think> blocks (DeepSeek R1 / reasoning models)
  return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export type AgentRole = keyof typeof ROLE_ASSIGNMENTS;

export async function callWithFallback(
  role: AgentRole,
  messages: ChatMessage[],
  options: CallOptions = {}
): Promise<{ content: string; providerName: string; model: string }> {
  const chain = FALLBACK_CHAINS[role] ?? [ROLE_ASSIGNMENTS[role]];
  let lastError: Error = new Error("No providers available");

  for (const { provider, model } of chain) {
    try {
      const content = await callProvider(provider, model, messages, options);
      const displayName = PROVIDER_CONFIGS[provider]?.displayName ?? provider;
      return { content, providerName: displayName, model };
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI] ${provider}/${model} failed: ${err.message}`);
    }
  }

  throw lastError;
}

function getEnvVar(provider: string): string {
  const map: Record<string, string> = {
    groq: "GROQ_API_KEY",
    nvidia: "NVIDIA_API_KEY",
    github: "GITHUB_TOKEN",
  };
  return map[provider] ?? "UNKNOWN";
}
