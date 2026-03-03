import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SupportTicket } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Layers, HelpCircle, Plus, MessageCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Support() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  const { data: tickets, isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string }) => {
      await apiRequest("POST", "/api/support", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support"] });
      setShowNewTicket(false);
      setSubject("");
      setMessage("");
      toast({ title: "Ticket submitted", description: "We'll get back to you soon" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    open: { icon: Clock, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Open" },
    in_progress: { icon: MessageCircle, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "In Progress" },
    resolved: { icon: CheckCircle2, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Resolved" },
    closed: { icon: XCircle, color: "bg-muted text-muted-foreground", label: "Closed" },
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto flex items-center gap-4 px-6 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
              <Layers className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">PixelPrompt</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-support-title">Help & Support</h1>
            <p className="text-sm text-muted-foreground mt-1">Get help with your account or report issues</p>
          </div>
          <Button onClick={() => setShowNewTicket(true)} data-testid="button-new-ticket">
            <Plus className="w-4 h-4 mr-1" />
            New Ticket
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-5 w-1/2 mb-2" /><Skeleton className="h-4 w-1/3" /></CardContent></Card>
            ))}
          </div>
        ) : tickets && tickets.length > 0 ? (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const config = statusConfig[ticket.status] || statusConfig.open;
              const StatusIcon = config.icon;
              return (
                <Card
                  key={ticket.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                  data-testid={`card-ticket-${ticket.id}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <StatusIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium truncate" data-testid={`text-ticket-subject-${ticket.id}`}>{ticket.subject}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium shrink-0 ${config.color}`} data-testid={`badge-ticket-status-${ticket.id}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{ticket.message}</p>
                    {expandedTicket === ticket.id && ticket.adminReply && (
                      <div className="mt-3 p-3 bg-muted rounded-md">
                        <p className="text-xs font-medium mb-1 text-muted-foreground">Admin Reply:</p>
                        <p className="text-sm">{ticket.adminReply}</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {ticket.createdAt ? format(new Date(ticket.createdAt), "MMM d, yyyy 'at' h:mm a") : ""}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">No support tickets</h3>
              <p className="text-sm text-muted-foreground mb-4">Create a ticket if you need help or want to report an issue</p>
              <Button onClick={() => setShowNewTicket(true)} data-testid="button-empty-new-ticket">
                <Plus className="w-4 h-4 mr-1" />
                Create Ticket
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit a Support Ticket</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (subject.trim() && message.trim()) {
                createMutation.mutate({ subject: subject.trim(), message: message.trim() });
              }
            }}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Subject</Label>
                <Input
                  placeholder="Brief description of your issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  autoFocus
                  data-testid="input-ticket-subject"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Message</Label>
                <Textarea
                  placeholder="Describe your issue in detail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="resize-none min-h-[100px]"
                  data-testid="input-ticket-message"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowNewTicket(false)}>Cancel</Button>
              <Button type="submit" disabled={!subject.trim() || !message.trim() || createMutation.isPending} data-testid="button-submit-ticket">
                {createMutation.isPending ? "Submitting..." : "Submit Ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
