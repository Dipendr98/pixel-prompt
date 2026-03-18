import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import type { ComponentBlock } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Send, Sparkles, Bot, UserIcon, Loader2,
  CheckCircle2, XCircle, Clock, Zap, Eye, Brain, FileUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type PhaseName = "discover" | "plan" | "code" | "review";

interface AgentTask {
  id: string;
  phase: PhaseName;
  description: string;
  status: "pending" | "running" | "done" | "failed";
  providerName?: string;
  model?: string;
}

type StreamEvent =
  | { type: "phase_start"; phase: string; message: string }
  | { type: "phase_end"; phase: string; message: string; data?: unknown }
  | { type: "task_update"; task: AgentTask }
  | { type: "log"; message: string }
  | { type: "error"; message: string; fatal?: boolean }
  | { type: "complete"; blocks: ComponentBlock[]; message: string; plan?: { intent: string } };

interface Message {
  id: string;
  role: "user" | "assistant" | "agent";
  content: string;
  blocks?: ComponentBlock[];
  tasks?: AgentTask[];
  isStreaming?: boolean;
  error?: boolean;
  progressPercent?: number;
}

interface AiPanelProps {
  onApplyBlocks: (blocks: ComponentBlock[]) => void;
  projectId: string;
}

// ── Agent phase metadata ──────────────────────────────────────────────────────

const PHASE_META: Record<PhaseName, {
  icon: React.ComponentType<{ className?: string }>; label: string; color: string; bg: string; border: string; provider: string;
}> = {
  discover: {
    icon: Brain,
    label: "Discovery",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    provider: "Intelligence Engine",
  },
  plan: {
    icon: Brain,
    label: "Planner",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    provider: "Analysis Engine",
  },
  code: {
    icon: Zap,
    label: "Coder",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    provider: "Generation Engine",
  },
  review: {
    icon: Eye,
    label: "Reviewer",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    provider: "Validation Engine",
  },
};

function TaskBadge({ task }: { task: AgentTask }) {
  const meta = PHASE_META[task.phase] ?? PHASE_META["plan"];
  const Icon = meta.icon;

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs ${meta.bg} ${meta.border}`}
    >
      {task.status === "running" ? (
        <Loader2 className={`w-3 h-3 animate-spin ${meta.color}`} />
      ) : task.status === "done" ? (
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
      ) : task.status === "failed" ? (
        <XCircle className="w-3 h-3 text-red-400" />
      ) : (
        <Clock className="w-3 h-3 text-muted-foreground" />
      )}
      <Icon className={`w-3 h-3 ${meta.color}`} />
      <span className={`font-medium ${meta.color}`}>{meta.label}</span>
      {task.providerName && (
        <span className="text-muted-foreground">· {task.providerName}</span>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AiPanel({ onApplyBlocks, projectId }: AiPanelProps) {
  const { isPro } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm your multi-agent AI assistant.\n\n" +
        "Describe what you want to build, or upload your CV to auto-build a portfolio!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cvAbortRef = useRef<AbortController | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  // Derived — true while a CV message is still streaming
  const isCvParsing = messages.some(m => m.id.startsWith("cv-") && m.isStreaming);

  useEffect(() => {
    // ScrollArea forwards ref to Root — the actual scrollable element is the Viewport child
    const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  // Abort any in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      cvAbortRef.current?.abort();
    };
  }, []);

  const handleSend = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || isGenerating) return;

    setInput("");
    setIsGenerating(true);

    // Add user message
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);

    // Add streaming agent message placeholder
    const agentMsgId = `a-${Date.now()}`;
    const agentMsg: Message = {
      id: agentMsgId,
      role: "agent",
      content: "",
      isStreaming: true,
      tasks: [],
      progressPercent: 0,
    };
    setMessages((prev) => [...prev, agentMsg]);

    const updateAgentMsg = (updater: (prev: Message) => Message) => {
      setMessages((msgs) =>
        msgs.map((m) => (m.id === agentMsgId ? updater(m) : m))
      );
    };

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({ prompt, projectId }),
        signal: abortRef.current.signal,
        credentials: "include",
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(err.message || "AI request failed");
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let logLines: string[] = [];
      const MAX_LOG_LINES = 150;
      const phaseDone: Record<string, boolean> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining buffer content after stream ends
          buffer += decoder.decode();
        } else {
          buffer += decoder.decode(value, { stream: true });
        }
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          let event: StreamEvent;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          switch (event.type) {
            case "phase_start":
              if (logLines.length >= MAX_LOG_LINES) logLines = logLines.slice(-100);
              logLines.push(event.message);
              updateAgentMsg((m) => ({
                ...m,
                content: logLines.join("\n"),
                progressPercent: event.phase === "discover" ? 5 : event.phase === "plan" ? 20 : event.phase === "code" ? 45 : 80,
              }));
              break;

            case "phase_end":
              phaseDone[event.phase] = true;
              logLines.push(event.message);
              updateAgentMsg((m) => ({
                ...m,
                content: logLines.join("\n"),
                progressPercent:
                  event.phase === "discover" ? 18 : event.phase === "plan" ? 38 : event.phase === "code" ? 72 : 92,
              }));
              break;

            case "task_update":
              updateAgentMsg((m) => {
                const existingIdx = (m.tasks ?? []).findIndex(
                  (t) => t.id === event.task.id
                );
                const newTasks =
                  existingIdx >= 0
                    ? (m.tasks ?? []).map((t, i) =>
                        i === existingIdx ? event.task : t
                      )
                    : [...(m.tasks ?? []), event.task];
                return { ...m, tasks: newTasks };
              });
              break;

            case "log":
              if (logLines.length >= MAX_LOG_LINES) logLines = logLines.slice(-100);
              logLines.push(event.message);
              updateAgentMsg((m) => ({ ...m, content: logLines.join("\n") }));
              break;

            case "error":
              logLines.push(`❌ ${event.message}`);
              updateAgentMsg((m) => ({
                ...m,
                content: logLines.join("\n"),
                error: event.fatal,
              }));
              break;

            case "complete":
              updateAgentMsg((m) => ({
                ...m,
                content: event.message,
                blocks: event.blocks,
                tasks: m.tasks,
                isStreaming: false,
                progressPercent: 100,
                error: false,
              }));
              break;
          }
        }
        if (done) break;
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        updateAgentMsg((m) => ({
          ...m,
          content: "Generation cancelled.",
          isStreaming: false,
        }));
      } else {
        updateAgentMsg((m) => ({
          ...m,
          content: `Error: ${err.message}`,
          isStreaming: false,
          error: true,
        }));
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [input, isGenerating, projectId]);

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleCvUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (cvInputRef.current) cvInputRef.current.value = "";

    const cvMsgId = `cv-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `uCV-${Date.now()}`, role: "user", content: `📎 Uploaded CV: ${file.name}` },
      { id: cvMsgId, role: "agent", content: `📄 Parsing your CV: ${file.name}\nExtracting skills, projects, and experience...`, isStreaming: true, progressPercent: 30 },
    ]);

    cvAbortRef.current = new AbortController();
    try {
      const formData = new FormData();
      formData.append("cv", file);
      const res = await fetch("/api/ai/cv-parse", {
        method: "POST",
        body: formData,
        credentials: "include",
        signal: cvAbortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || "CV parsing failed");
      }

      const data = await res.json();
      setMessages((msgs) => msgs.map((m) => m.id === cvMsgId ? {
        ...m,
        content: `✅ CV parsed! Found ${data.skills?.length || 0} skills, ${data.projects?.length || 0} projects, ${data.experience?.length || 0} experience entries.\n\nApply these blocks to auto-populate your portfolio:`,
        blocks: data.blocks,
        isStreaming: false,
        progressPercent: 100,
        error: false,
      } : m));
      toast({ title: "CV parsed successfully!", description: `Extracted ${data.skills?.length || 0} skills and ${data.projects?.length || 0} projects` });
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setMessages((msgs) => msgs.map((m) => m.id === cvMsgId ? {
        ...m,
        content: `❌ CV parsing failed: ${err.message}\n\nTip: Make sure your CV is in .txt, .pdf, or .md format.`,
        isStreaming: false,
        error: true,
      } : m));
    } finally {
      cvAbortRef.current = null;
    }
  }, [toast]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold" data-testid="text-ai-title">
            AI Agent
          </h2>
          <Badge variant="outline" className="text-xs hidden sm:inline-flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            3 models
          </Badge>
        </div>
        {!isPro && (
          <Badge variant="secondary" className="text-xs" data-testid="badge-ai-limit">
            3/day free
          </Badge>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef as any}>
        <div className="p-3 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {/* Bot avatar */}
              {msg.role !== "user" && (
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}

              <div className={`max-w-[90%] space-y-2 ${msg.role === "user" ? "text-right" : ""}`}>
                {/* Message bubble */}
                <div
                  className={`text-sm rounded-md px-3 py-2 inline-block text-left whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : msg.error
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : "bg-muted"
                  }`}
                  data-testid={`text-ai-message-${msg.id}`}
                >
                  {msg.content || (msg.isStreaming ? "Starting agents…" : "")}
                  {msg.isStreaming && (
                    <span className="inline-block ml-1 opacity-70 animate-pulse">▋</span>
                  )}
                </div>

                {/* Progress bar while streaming */}
                {msg.isStreaming && typeof msg.progressPercent === "number" && (
                  <Progress value={msg.progressPercent} className="h-1 w-full" />
                )}

                {/* Agent task badges */}
                {msg.tasks && msg.tasks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.tasks.map((task) => (
                      <TaskBadge key={task.id} task={task} />
                    ))}
                  </div>
                )}

                {/* Apply blocks button */}
                {msg.blocks && msg.blocks.length > 0 && !msg.isStreaming && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {msg.blocks.length} block{msg.blocks.length !== 1 ? "s" : ""} ready
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onApplyBlocks(msg.blocks!)}
                      data-testid={`button-apply-blocks-${msg.id}`}
                    >
                      Apply to Canvas
                    </Button>
                  </div>
                )}
              </div>

              {/* User avatar */}
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Agent pipeline indicator */}
      {isGenerating && (
        <div className="px-3 py-2 border-t flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 overflow-x-auto">
          {(["discover", "plan", "code", "review"] as const).map((phase, i) => {
            const meta = PHASE_META[phase];
            const Icon = meta.icon;
            return (
              <span key={phase} className="flex items-center gap-1 shrink-0">
                {i > 0 && <span className="text-muted-foreground/40">→</span>}
                <Icon className={`w-3 h-3 ${meta.color}`} />
                <span className={meta.color}>{meta.label}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Build a SaaS landing page with pricing…"
            className="resize-none min-h-[60px] flex-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isGenerating}
            data-testid="input-ai-prompt"
          />
          {isGenerating ? (
            <Button
              type="button"
              variant="destructive"
              className="shrink-0 gap-1.5 px-3"
              onClick={handleCancel}
              title="Stop Generation"
            >
              <XCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Stop</span>
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              className="shrink-0"
              data-testid="button-ai-send"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </form>

        {/* CV Upload + Model info */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(PHASE_META).map(([, meta]) => {
              const Icon = meta.icon;
              return (
                <span key={meta.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Icon className={`w-2.5 h-2.5 ${meta.color}`} />
                  {meta.provider}
                </span>
              );
            })}
          </div>
          <button
            type="button"
            disabled={isGenerating || isCvParsing}
            onClick={() => cvInputRef.current?.click()}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted disabled:opacity-50 shrink-0"
            title="Upload CV to auto-build portfolio"
          >
            {isCvParsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileUp className="w-3 h-3" />}
            Upload CV
          </button>
          <input
            ref={cvInputRef}
            type="file"
            accept=".txt,.pdf,.md,.doc,.docx"
            className="hidden"
            onChange={handleCvUpload}
          />
        </div>
      </div>
    </div>
  );
}
