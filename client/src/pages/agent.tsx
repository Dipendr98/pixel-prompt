/**
 * PixelPrompt AI Agent — Replit-style multi-agent builder
 *
 * Full-screen experience:
 *   Left:  Chat + real-time agent pipeline status
 *   Right: Live preview iframe of your PixelPrompt project
 *
 * Pipeline: Planner (Groq) → Coder (NVIDIA NIM) → Reviewer (GitHub Models)
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { ComponentBlock } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Sparkles, Bot, UserIcon, Loader2, CheckCircle2,
  XCircle, Clock, Zap, Eye, Brain, ArrowLeft, RefreshCw,
  ChevronDown, ChevronRight, Info,
} from "lucide-react";

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
  role: "user" | "agent";
  content: string;
  blocks?: ComponentBlock[];
  tasks?: AgentTask[];
  logs?: string[];
  isStreaming?: boolean;
  error?: boolean;
  progressPercent?: number;
  plan?: { intent: string };
  blockCount?: number;
}

// ── Phase metadata ────────────────────────────────────────────────────────────

const PHASES: Record<PhaseName, {
  icon: React.ComponentType<{ className?: string }>; label: string; sublabel: string; color: string; bg: string; border: string; dot: string;
}> = {
  discover: {
    icon: Brain,
    label: "Discovery",
    sublabel: "Analyzes audience, goal & narrative",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    dot: "bg-orange-400",
  },
  plan: {
    icon: Brain,
    label: "Planner",
    sublabel: "Architects the page structure",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    dot: "bg-violet-400",
  },
  code: {
    icon: Zap,
    label: "Coder",
    sublabel: "Generates specific, real content",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    dot: "bg-sky-400",
  },
  review: {
    icon: Eye,
    label: "Reviewer",
    sublabel: "Deep quality & coherence check",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    dot: "bg-emerald-400",
  },
};

// ── Task badge ────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: AgentTask }) {
  const meta = PHASES[task.phase] ?? PHASES["plan"];
  const Icon = meta.icon;

  return (
    <div className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${meta.bg} ${meta.border}`}>
      <div className="flex items-center gap-1.5 mt-0.5">
        {task.status === "running" ? (
          <Loader2 className={`w-3.5 h-3.5 animate-spin ${meta.color}`} />
        ) : task.status === "done" ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : task.status === "failed" ? (
          <XCircle className="w-3.5 h-3.5 text-red-400" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
          {task.providerName && (
            <span className="text-[10px] text-muted-foreground">{task.providerName}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
      </div>
    </div>
  );
}

// ── Agent message ─────────────────────────────────────────────────────────────

function AgentMessage({
  msg,
  onApply,
}: {
  msg: Message;
  onApply: (blocks: ComponentBlock[]) => void;
}) {
  const [logsExpanded, setLogsExpanded] = useState(false);

  return (
    <div className="flex gap-3 items-start">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-4 h-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {/* Agent tasks */}
        {msg.tasks && msg.tasks.length > 0 && (
          <div className="space-y-1.5">
            {msg.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}

        {/* Progress bar */}
        {msg.isStreaming && typeof msg.progressPercent === "number" && (
          <Progress value={msg.progressPercent} className="h-1" />
        )}

        {/* Log lines (collapsible) */}
        {msg.logs && msg.logs.length > 0 && (
          <div className="rounded-lg bg-muted/50 border text-xs font-mono overflow-hidden">
            <button
              onClick={() => setLogsExpanded((p) => !p)}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-muted/80 transition-colors"
            >
              {logsExpanded ? (
                <ChevronDown className="w-3 h-3 shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 shrink-0" />
              )}
              <span className="text-muted-foreground">
                {logsExpanded ? "Hide" : "Show"} agent log ({msg.logs.length} events)
              </span>
            </button>
            {logsExpanded && (
              <div className="px-3 pb-2 space-y-0.5 max-h-40 overflow-y-auto">
                {msg.logs.map((line, i) => (
                  <p key={i} className="text-muted-foreground leading-4">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Final message / error */}
        {(msg.content || (!msg.isStreaming && msg.error)) && (
          <div
            className={`text-sm rounded-lg px-3 py-2 whitespace-pre-wrap ${
              msg.error
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-muted"
            }`}
          >
            {msg.content || "An error occurred."}
          </div>
        )}

        {/* Streaming indicator */}
        {msg.isStreaming && !msg.content && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Agents working…</span>
          </div>
        )}

        {/* Apply blocks */}
        {msg.blocks && msg.blocks.length > 0 && !msg.isStreaming && (
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-muted-foreground">
                {msg.blocks.length} block{msg.blocks.length !== 1 ? "s" : ""} generated
              </span>
            </div>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => onApply(msg.blocks!)}
            >
              Apply to Project
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgentPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const { isPro } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [appliedBlocks, setAppliedBlocks] = useState<ComponentBlock[] | null>(null);

  const { data: project } = useQuery({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const res = await apiRequest("GET", `/api/projects/${projectId}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  // Abort streaming on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleApplyBlocks = useCallback(
    async (blocks: ComponentBlock[]) => {
      if (!projectId) {
        toast({ title: "No project selected", description: "Open a project first to apply blocks.", variant: "destructive" });
        return;
      }
      try {
        setAppliedBlocks(blocks);
        // Update project schema with new blocks (append)
        const res = await apiRequest("PATCH", `/api/projects/${projectId}`, {
          schema: { pages: [{ id: "home", name: "Home", path: "/", blocks }] },
        });
        if (!res.ok) throw new Error("Failed to save");
        toast({ title: "Applied!", description: `${blocks.length} blocks applied to your project.` });
      } catch {
        toast({ title: "Error", description: "Could not apply blocks.", variant: "destructive" });
      }
    },
    [projectId, toast]
  );

  const handleSend = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || isGenerating) return;

    setInput("");
    setIsGenerating(true);

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);

    const agentId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: agentId,
        role: "agent",
        content: "",
        isStreaming: true,
        tasks: [],
        logs: [],
        progressPercent: 5,
      },
    ]);

    const updateMsg = (updater: (m: Message) => Message) =>
      setMessages((msgs) => msgs.map((m) => (m.id === agentId ? updater(m) : m)));

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ prompt, projectId }),
        signal: abortRef.current.signal,
        credentials: "include",
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(err.message ?? "AI request failed");
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buf += decoder.decode();
        } else {
          buf += decoder.decode(value, { stream: true });
        }
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: StreamEvent;
          try { event = JSON.parse(line); } catch { continue; }

          switch (event.type) {
            case "phase_start":
              updateMsg((m) => ({
                ...m,
                logs: [...(m.logs ?? []), event.message],
                progressPercent:
                  event.phase === "discover" ? 5
                  : event.phase === "plan" ? 22
                  : event.phase === "code" ? 45
                  : 78,
              }));
              break;

            case "phase_end":
              updateMsg((m) => ({
                ...m,
                logs: [...(m.logs ?? []), event.message],
                progressPercent:
                  event.phase === "discover" ? 20
                  : event.phase === "plan" ? 40
                  : event.phase === "code" ? 74
                  : 93,
              }));
              break;

            case "task_update":
              updateMsg((m) => {
                const idx = (m.tasks ?? []).findIndex((t) => t.id === event.task.id);
                const newTasks =
                  idx >= 0
                    ? (m.tasks ?? []).map((t, i) => (i === idx ? event.task : t))
                    : [...(m.tasks ?? []), event.task];
                return { ...m, tasks: newTasks };
              });
              break;

            case "log":
              updateMsg((m) => ({ ...m, logs: [...(m.logs ?? []), event.message] }));
              break;

            case "error":
              updateMsg((m) => ({
                ...m,
                logs: [...(m.logs ?? []), `❌ ${event.message}`],
                error: !!event.fatal,
              }));
              break;

            case "complete":
              updateMsg((m) => ({
                ...m,
                content: event.message,
                blocks: event.blocks,
                plan: event.plan,
                blockCount: event.blocks?.length ?? 0,
                isStreaming: false,
                progressPercent: 100,
                error: false,
              }));
              // Auto-apply if project linked
              if (event.blocks?.length && projectId) {
                handleApplyBlocks(event.blocks);
              }
              break;
          }
        }
        if (done) break;
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        updateMsg((m) => ({
          ...m,
          content: `Error: ${err.message}`,
          isStreaming: false,
          error: true,
        }));
      } else {
        updateMsg((m) => ({ ...m, content: "Cancelled.", isStreaming: false }));
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [input, isGenerating, projectId, handleApplyBlocks]);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-2 border-b shrink-0 bg-background/80 backdrop-blur-sm">
        <Link href={projectId ? `/builder/${projectId}` : "/dashboard"}>
          <Button variant="ghost" size="sm" className="gap-1.5 h-8">
            <ArrowLeft className="w-3.5 h-3.5" />
            {projectId ? "Back to Builder" : "Dashboard"}
          </Button>
        </Link>

        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">PixelPrompt AI Agent</span>
          <Badge variant="secondary" className="text-xs">Beta</Badge>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Live provider pills */}
          {Object.entries(PHASES).map(([, meta]) => {
            const Icon = meta.icon;
            return (
              <div
                key={meta.label}
                className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${meta.bg} ${meta.border} border`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${isGenerating ? "animate-pulse" : ""}`} />
                <Icon className={`w-3 h-3 ${meta.color}`} />
                <span className={meta.color}>{meta.label}</span>
              </div>
            );
          })}
          {!isPro && (
            <Link href="/billing">
              <Button variant="outline" size="sm" className="h-7 text-xs">Upgrade Pro</Button>
            </Link>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Chat panel ─────────────────────────────────────────────── */}
        <div className="flex flex-col w-full md:w-[480px] lg:w-[520px] border-r shrink-0">
          {/* Intro banner */}
          {messages.length === 0 && (
            <div className="m-4 p-4 rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Multi-Agent Website Builder</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Describe the website you want. Three specialized AI agents will plan,
                    code, and review your site automatically.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {Object.entries(PHASES).map(([, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <div key={meta.label} className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${meta.bg} ${meta.border}`}>
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                      <span className={`text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                      <span className="text-[9px] text-center text-muted-foreground leading-tight">{meta.sublabel}</span>
                    </div>
                  );
                })}
              </div>

              {/* Quick prompts */}
              <div className="mt-3 space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <Info className="w-3 h-3" /> Quick start
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Build a SaaS landing page with pricing",
                    "Create an e-commerce store for electronics",
                    "Make a portfolio site for a photographer",
                    "Design a restaurant homepage with menu",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-[10px] px-2 py-1 rounded-md bg-background border hover:border-primary hover:text-primary transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 px-4" ref={scrollRef as any}>
            <div className="py-3 space-y-5">
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <div key={msg.id} className="flex gap-2 justify-end">
                    <div className="max-w-[85%] bg-primary text-primary-foreground text-sm rounded-xl px-3 py-2">
                      {msg.content}
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ) : (
                  <AgentMessage key={msg.id} msg={msg} onApply={handleApplyBlocks} />
                )
              )}
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="p-4 border-t shrink-0 space-y-2">
            {project && (
              <p className="text-xs text-muted-foreground">
                Building into: <span className="text-foreground font-medium">{project.name}</span>
              </p>
            )}
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe the website you want to build…"
                className="resize-none min-h-[72px] text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isGenerating}
              />
              {isGenerating ? (
                <Button type="button" variant="destructive" className="shrink-0 self-end gap-1.5 px-3" onClick={() => abortRef.current?.abort()}>
                  <XCircle className="w-4 h-4" />
                  Stop
                </Button>
              ) : (
                <Button type="submit" size="icon" className="shrink-0 self-end" disabled={!input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </form>
          </div>
        </div>

        {/* ── Right: Preview panel ──────────────────────────────────────────── */}
        <div className="hidden md:flex flex-1 flex-col">
          {/* Preview header */}
          <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
            <span className="text-sm font-medium text-muted-foreground">Live Preview</span>
            {projectId && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => window.open(`/builder/${projectId}`, "_blank")}
                >
                  <RefreshCw className="w-3 h-3" />
                  Open Builder
                </Button>
              </div>
            )}
          </div>

          {/* Preview area */}
          <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 p-4 overflow-hidden">
            {appliedBlocks ? (
              <div className="w-full h-full border rounded-xl overflow-hidden bg-white">
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                  <div>
                    <p className="text-lg font-semibold">
                      {appliedBlocks.length} Blocks Applied!
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your project has been updated with the generated blocks.
                    </p>
                  </div>
                  {projectId && (
                    <Link href={`/builder/${projectId}`}>
                      <Button>Open in Builder</Button>
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Preview appears here</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Generate blocks to see your website come to life
                  </p>
                </div>
                {!projectId && (
                  <Link href="/dashboard">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Select a Project
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
