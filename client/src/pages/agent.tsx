/**
 * PixelPrompt AI Agent — Replit-style multi-agent builder
 *
 * Full-screen experience:
 *   Left:  Chat + real-time agent pipeline status
 *   Right: Live preview iframe of your PixelPrompt project
 *
 * Pipeline: Discovery (Groq) → Planner (Groq) → Coder (NVIDIA NIM) → Reviewer (GitHub Models)
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { ComponentBlock } from "@shared/schema";
import { buildPreviewHtml } from "@/lib/preview";
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
  ChevronDown, ChevronRight, Info, Crown, Monitor, Edit3, Globe,
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
}: {
  msg: Message;
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

        {/* Block count badge */}
        {msg.blocks && msg.blocks.length > 0 && !msg.isStreaming && (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">
              {msg.blocks.length} block{msg.blocks.length !== 1 ? "s" : ""} generated & applied to preview
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Preview Panel ─────────────────────────────────────────────────────────────

function PreviewPanel({
  blocks,
  projectName,
  hasBlocks,
  isGenerating,
}: {
  blocks: ComponentBlock[];
  projectName: string;
  hasBlocks: boolean;
  isGenerating: boolean;
}) {
  const previewHtml = hasBlocks ? buildPreviewHtml(blocks, {}, projectName) : "";

  if (isGenerating && !hasBlocks) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <div>
          <p className="font-medium">Building your website…</p>
          <p className="text-sm text-muted-foreground mt-1">Preview will appear once agents complete</p>
        </div>
      </div>
    );
  }

  if (!hasBlocks) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <div>
          <p className="font-medium text-muted-foreground">Preview appears here</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Describe your website and agents will build it</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <iframe
        srcDoc={previewHtml}
        className="flex-1 w-full border-0"
        title="Website Preview"
        sandbox="allow-scripts"
      />
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
  const [hasBlocks, setHasBlocks] = useState(false);
  const [previewBlocks, setPreviewBlocks] = useState<ComponentBlock[]>([]);
  const [previewKey, setPreviewKey] = useState(0);

  const { data: project } = useQuery({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const res = await apiRequest("GET", `/api/projects/${projectId}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: credits, refetch: refetchCredits } = useQuery<{
    plan: string;
    creditsUsed: number;
    creditsTotal: number;
    creditsRemaining: number;
    totalGenerations: number;
    generationsRemaining: number;
  }>({
    queryKey: ["/api/credits"],
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

  // Load existing blocks when project data arrives
  useEffect(() => {
    const existing = project?.schema?.pages?.[0]?.blocks;
    if (existing?.length > 0) {
      setHasBlocks(true);
      setPreviewBlocks(existing);
    }
  }, [project]);

  const handleApplyBlocks = useCallback(
    async (blocks: ComponentBlock[]) => {
      if (!projectId) return;
      try {
        const res = await apiRequest("PATCH", `/api/projects/${projectId}`, {
          schema: { pages: [{ id: "home", name: "Home", path: "/", blocks }] },
        });
        if (!res.ok) throw new Error("Failed to save");
        setHasBlocks(true);
        setPreviewBlocks(blocks);
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
              if (event.blocks?.length && projectId) {
                await handleApplyBlocks(event.blocks);
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
      refetchCredits();
    }
  }, [input, isGenerating, projectId, handleApplyBlocks, refetchCredits]);

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
          {credits && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              credits.plan === 'pro'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : credits.creditsRemaining <= 500
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {credits.plan === 'pro' ? (
                <><Crown className="w-3 h-3" /> {credits.creditsRemaining.toLocaleString()} / 10K</>
              ) : (
                <><Zap className="w-3 h-3" /> {credits.creditsRemaining.toLocaleString()} credits</>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Chat panel ─────────────────────────────────────────────── */}
        <div className="flex flex-col w-full md:w-[420px] lg:w-[460px] border-r shrink-0">
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

              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.entries(PHASES).map(([, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <div key={meta.label} className={`flex items-center gap-2 p-2 rounded-lg border ${meta.bg} ${meta.border}`}>
                      <Icon className={`w-4 h-4 ${meta.color} shrink-0`} />
                      <div>
                        <span className={`text-[10px] font-semibold ${meta.color} block`}>{meta.label}</span>
                        <span className="text-[9px] text-muted-foreground leading-tight">{meta.sublabel}</span>
                      </div>
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
                  <AgentMessage key={msg.id} msg={msg} />
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
        <div className="hidden md:flex flex-1 flex-col overflow-hidden">
          {/* Preview toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 bg-background">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Live Preview</span>
              {hasBlocks && !isGenerating && (
                <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                  Live
                </Badge>
              )}
              {isGenerating && (
                <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/10">
                  <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />
                  Generating
                </Badge>
              )}
            </div>
            {projectId && hasBlocks && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => setPreviewKey((k) => k + 1)}
                  title="Refresh preview"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </Button>
                <Separator orientation="vertical" className="h-4" />
                <Link href={`/builder/${projectId}`}>
                  <Button size="sm" className="gap-1.5 h-7 text-xs">
                    <Edit3 className="w-3 h-3" />
                    Open in Builder
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Browser chrome bar */}
          {hasBlocks && projectId && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30 shrink-0">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
              </div>
              <div className="flex-1 bg-background/80 rounded-md px-3 py-1 text-[11px] text-muted-foreground flex items-center gap-1.5 border">
                <Globe className="w-3 h-3" />
                <span>{project?.name ?? "Your Website"}</span>
              </div>
            </div>
          )}

          {/* Preview area */}
          <PreviewPanel
            blocks={previewBlocks}
            projectName={project?.name || "Preview"}
            hasBlocks={hasBlocks}
            isGenerating={isGenerating}
          />

          {/* Bottom bar — only when preview is showing */}
          {hasBlocks && projectId && (
            <div className="flex items-center justify-between px-4 py-2 border-t shrink-0 bg-background/80 text-xs text-muted-foreground">
              <span>Generated with PixelPrompt AI</span>
              <Link href={`/builder/${projectId}`}>
                <button className="flex items-center gap-1 hover:text-primary transition-colors">
                  <Edit3 className="w-3 h-3" />
                  Edit in Canvas Builder
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
