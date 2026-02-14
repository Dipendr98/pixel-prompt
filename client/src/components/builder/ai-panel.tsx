import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { ComponentBlock } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Sparkles, Bot, UserIcon, Loader2 } from "lucide-react";

interface AiPanelProps {
  onApplyBlocks: (blocks: ComponentBlock[]) => void;
  projectId: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  blocks?: ComponentBlock[];
}

export function AiPanel({ onApplyBlocks, projectId }: AiPanelProps) {
  const { isPro } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I can help you generate website sections. Try asking me to create a hero section, feature grid, or any other component. I'll generate the blocks for your canvas.",
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const aiMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", "/api/ai", { prompt, projectId });
      return res.json();
    },
    onSuccess: (data) => {
      const assistantMsg: Message = {
        role: "assistant",
        content: data.message || "Here are the generated blocks. Click 'Apply' to add them to your canvas.",
        blocks: data.blocks,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    },
    onError: (err: any) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || aiMutation.isPending) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    aiMutation.mutate(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold" data-testid="text-ai-title">AI Assistant</h2>
        </div>
        {!isPro && (
          <Badge variant="secondary" className="text-xs" data-testid="badge-ai-limit">3/day free</Badge>
        )}
      </div>

      <ScrollArea className="flex-1" ref={scrollRef as any}>
        <div className="p-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "text-right" : ""}`}>
                <div
                  className={`text-sm rounded-md px-3 py-2 inline-block text-left ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                  data-testid={`text-ai-message-${i}`}
                >
                  {msg.content}
                </div>
                {msg.blocks && msg.blocks.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{msg.blocks.length} block(s) generated</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onApplyBlocks(msg.blocks!)}
                      data-testid={`button-apply-blocks-${i}`}
                    >
                      Apply to Canvas
                    </Button>
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {aiMutation.isPending && (
            <div className="flex gap-2 items-start">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-muted rounded-md px-3 py-2 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-sm text-muted-foreground">Generating...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Create a hero section with..."
            className="resize-none min-h-[60px] flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            data-testid="input-ai-prompt"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || aiMutation.isPending}
            data-testid="button-ai-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
