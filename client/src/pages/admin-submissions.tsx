import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Submission, SupportTicket, Project, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Layers, Shield, Users, FolderOpen, MessageSquare, FileText, BarChart3, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type SubmissionWithDetails = Submission & { projectName?: string; userEmail?: string };
type TicketWithUser = SupportTicket & { userEmail?: string };
type ProjectWithUser = Project & { userEmail?: string };

export default function AdminSubmissions() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [replyTicketId, setReplyTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: stats } = useQuery<{ totalUsers: number; totalProjects: number; activeSubscriptions: number; openTickets: number; totalSubmissions: number }>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: submissions, isLoading: loadingSubs } = useQuery<SubmissionWithDetails[]>({
    queryKey: ["/api/admin/submissions"],
  });

  const { data: tickets, isLoading: loadingTickets } = useQuery<TicketWithUser[]>({
    queryKey: ["/api/admin/tickets"],
  });

  const { data: allUsers, isLoading: loadingUsers } = useQuery<Omit<User, "password">[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: allProjects, isLoading: loadingProjects } = useQuery<ProjectWithUser[]>({
    queryKey: ["/api/admin/projects"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/submissions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/submissions"] });
      toast({ title: "Status updated" });
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, status, adminReply }: { id: string; status?: string; adminReply?: string }) => {
      await apiRequest("PATCH", `/api/admin/tickets/${id}`, { status, adminReply });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setReplyTicketId(null);
      setReplyText("");
      toast({ title: "Ticket updated" });
    },
  });

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-8 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold mb-1">Access Denied</h2>
            <p className="text-sm text-muted-foreground">You need admin permissions to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    closed: "bg-muted text-muted-foreground",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto flex items-center gap-4 px-6 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
              <Layers className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">BuilderPro</span>
          </Link>
          <Badge variant="outline" className="ml-auto">Admin Panel</Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-1" data-testid="text-admin-title">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mb-6">Manage your platform</p>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: "Users", value: stats.totalUsers, icon: Users },
              { label: "Projects", value: stats.totalProjects, icon: FolderOpen },
              { label: "Pro Subs", value: stats.activeSubscriptions, icon: BarChart3 },
              { label: "Open Tickets", value: stats.openTickets, icon: MessageSquare },
              { label: "Submissions", value: stats.totalSubmissions, icon: FileText },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4 text-center">
                  <s.icon className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-2xl font-bold" data-testid={`stat-${s.label.toLowerCase().replace(/\s/g, "-")}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="submissions">
          <TabsList>
            <TabsTrigger value="submissions" className="gap-1">
              <FileText className="w-3.5 h-3.5" />
              Submissions
            </TabsTrigger>
            <TabsTrigger value="tickets" className="gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              Support Tickets
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-1">
              <FolderOpen className="w-3.5 h-3.5" />
              All Projects
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1">
              <Users className="w-3.5 h-3.5" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="mt-4">
            {loadingSubs ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-5 w-1/2 mb-2" /><Skeleton className="h-4 w-1/3" /></CardContent></Card>)}</div>
            ) : submissions && submissions.length > 0 ? (
              <div className="space-y-3">
                {submissions.map((sub) => (
                  <Card key={sub.id} data-testid={`card-submission-${sub.id}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium" data-testid={`text-project-${sub.id}`}>{sub.projectName || "Project"}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusColors[sub.status] || "bg-muted"}`}
                                  data-testid={`badge-status-${sub.id}`}>
                              {sub.status}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{sub.userEmail || "User"}</p>
                          {sub.notes && <p className="text-sm mt-2">{sub.notes}</p>}
                          <p className="text-xs text-muted-foreground mt-2">
                            {sub.createdAt ? format(new Date(sub.createdAt), "MMM d, yyyy 'at' h:mm a") : ""}
                          </p>
                        </div>
                        <Select
                          value={sub.status}
                          onValueChange={(value) => updateStatusMutation.mutate({ id: sub.id, status: value })}
                        >
                          <SelectTrigger className="w-32" data-testid={`select-status-${sub.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="reviewing">Reviewing</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-medium mb-1">No submissions yet</h3>
                  <p className="text-sm text-muted-foreground">Submissions from users will appear here</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="tickets" className="mt-4">
            {loadingTickets ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-5 w-1/2 mb-2" /><Skeleton className="h-4 w-1/3" /></CardContent></Card>)}</div>
            ) : tickets && tickets.length > 0 ? (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <Card key={ticket.id} data-testid={`card-ticket-${ticket.id}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium">{ticket.subject}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusColors[ticket.status] || "bg-muted"}`}>
                              {ticket.status}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{ticket.userEmail || "User"}</p>
                          <p className="text-sm mt-2">{ticket.message}</p>
                          {ticket.adminReply && (
                            <div className="mt-2 p-2 bg-muted rounded-md">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Your Reply:</p>
                              <p className="text-sm">{ticket.adminReply}</p>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {ticket.createdAt ? format(new Date(ticket.createdAt), "MMM d, yyyy 'at' h:mm a") : ""}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Select
                            value={ticket.status}
                            onValueChange={(value) => updateTicketMutation.mutate({ id: ticket.id, status: value })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => { setReplyTicketId(ticket.id); setReplyText(ticket.adminReply || ""); }} data-testid={`button-reply-${ticket.id}`}>
                            <Send className="w-3.5 h-3.5 mr-1" />
                            Reply
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-medium mb-1">No tickets</h3>
                  <p className="text-sm text-muted-foreground">Support tickets from users will appear here</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="projects" className="mt-4">
            {loadingProjects ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-5 w-1/2 mb-2" /><Skeleton className="h-4 w-1/3" /></CardContent></Card>)}</div>
            ) : allProjects && allProjects.length > 0 ? (
              <div className="space-y-3">
                {allProjects.map((project) => (
                  <Card key={project.id} data-testid={`card-admin-project-${project.id}`}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{project.name}</span>
                          <p className="text-sm text-muted-foreground">{project.userEmail || "Unknown user"}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {Array.isArray(project.schema) ? (project.schema as any[]).length : 0} blocks
                            {project.updatedAt ? ` | Updated ${format(new Date(project.updatedAt), "MMM d, yyyy")}` : ""}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-medium mb-1">No projects</h3>
                  <p className="text-sm text-muted-foreground">User projects will appear here</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            {loadingUsers ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-5 w-1/2 mb-2" /><Skeleton className="h-4 w-1/3" /></CardContent></Card>)}</div>
            ) : allUsers && allUsers.length > 0 ? (
              <div className="space-y-3">
                {allUsers.map((u) => (
                  <Card key={u.id} data-testid={`card-user-${u.id}`}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-sm">{u.email}</span>
                            <p className="text-xs text-muted-foreground">ID: {u.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {u.role}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-medium mb-1">No users</h3>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!replyTicketId} onOpenChange={() => setReplyTicketId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to Ticket</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (replyTicketId && replyText.trim()) {
                updateTicketMutation.mutate({ id: replyTicketId, adminReply: replyText.trim(), status: "resolved" });
              }
            }}
          >
            <Textarea
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="resize-none min-h-[100px]"
              autoFocus
              data-testid="input-admin-reply"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setReplyTicketId(null)}>Cancel</Button>
              <Button type="submit" disabled={!replyText.trim() || updateTicketMutation.isPending} data-testid="button-send-reply">
                {updateTicketMutation.isPending ? "Sending..." : "Send Reply"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
