import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Submission, SupportTicket, Project, User, AutomationLog, Subscription } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, FolderOpen, MessageSquare, FileText,
  CreditCard, Zap, Play, CheckCircle, XCircle, Clock, RefreshCw,
  Send, Shield, Layers, Trash2, Search, ArrowLeft,
  TrendingUp, Activity, UserCheck, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

type SubmissionWithDetails = Submission & { projectName?: string; userEmail?: string };
type TicketWithUser = SupportTicket & { userEmail?: string };
type ProjectWithUser = Project & { userEmail?: string };
type SubWithUser = Subscription & { userEmail?: string };
type ActivityItem = { type: string; description: string; timestamp: string };

const AUTOMATION_JOBS = [
  { id: "reset_ai_usage", name: "Reset AI Usage", description: "Removes expired AI usage records from previous days", schedule: "Daily at midnight", icon: RefreshCw },
  { id: "check_subscriptions", name: "Check Subscriptions", description: "Finds and expires overdue subscriptions", schedule: "Every hour", icon: Clock },
  { id: "cleanup_pending_payments", name: "Cleanup Pending Payments", description: "Marks stale payment attempts as failed", schedule: "Every 6 hours", icon: Zap },
];

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "submissions", label: "Submissions", icon: FileText },
  { id: "tickets", label: "Support Tickets", icon: MessageSquare },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "automations", label: "Automations", icon: Zap },
];

export default function AdminSubmissions() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTicketId, setReplyTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; label: string } | null>(null);

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

  const { data: allSubscriptions, isLoading: loadingSubs2 } = useQuery<SubWithUser[]>({
    queryKey: ["/api/admin/subscriptions"],
  });

  const { data: automationLogs, isLoading: loadingLogs } = useQuery<AutomationLog[]>({
    queryKey: ["/api/admin/automations/logs"],
  });

  const { data: recentActivity } = useQuery<ActivityItem[]>({
    queryKey: ["/api/admin/activity"],
  });

  const runJobMutation = useMutation({
    mutationFn: async (jobName: string) => {
      const res = await apiRequest("POST", "/api/admin/automations/run", { jobName });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/automations/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Job completed", description: data.message });
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/automations/logs"] });
      toast({ title: "Job failed", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/submissions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
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

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      setDeleteConfirm(null);
      toast({ title: "User deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await apiRequest("DELETE", `/api/admin/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteConfirm(null);
      toast({ title: "Project deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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

  const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "approved": case "active": case "success": case "resolved": return "default";
      case "rejected": case "failed": case "closed": return "destructive";
      case "reviewing": case "in_progress": case "pending": case "running": return "secondary";
      default: return "outline";
    }
  };

  const activityIcon = (type: string) => {
    switch (type) {
      case "project_created": return <FolderOpen className="w-3.5 h-3.5" />;
      case "ticket_created": return <MessageSquare className="w-3.5 h-3.5" />;
      case "submission_created": return <FileText className="w-3.5 h-3.5" />;
      case "automation_run": return <Zap className="w-3.5 h-3.5" />;
      default: return <Activity className="w-3.5 h-3.5" />;
    }
  };

  const filteredUsers = allUsers?.filter(u =>
    !searchQuery || u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredProjects = allProjects?.filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.userEmail || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredTickets = tickets?.filter(t =>
    !searchQuery || t.subject.toLowerCase().includes(searchQuery.toLowerCase()) || (t.userEmail || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredSubmissions = submissions?.filter(s =>
    !searchQuery || (s.projectName || "").toLowerCase().includes(searchQuery.toLowerCase()) || (s.userEmail || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  const renderContent = () => {
    switch (activeSection) {
      case "overview": return renderOverview();
      case "users": return renderUsers();
      case "projects": return renderProjects();
      case "submissions": return renderSubmissions();
      case "tickets": return renderTickets();
      case "subscriptions": return renderSubscriptions();
      case "automations": return renderAutomations();
      default: return renderOverview();
    }
  };

  function renderOverview() {
    const statCards = [
      { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-blue-500" },
      { label: "Total Projects", value: stats?.totalProjects ?? 0, icon: FolderOpen, color: "text-emerald-500" },
      { label: "Pro Subscribers", value: stats?.activeSubscriptions ?? 0, icon: CreditCard, color: "text-violet-500" },
      { label: "Open Tickets", value: stats?.openTickets ?? 0, icon: MessageSquare, color: "text-amber-500" },
      { label: "Submissions", value: stats?.totalSubmissions ?? 0, icon: FileText, color: "text-rose-500" },
    ];

    const conversionRate = stats && stats.totalUsers > 0
      ? ((stats.activeSubscriptions / stats.totalUsers) * 100).toFixed(1)
      : "0";

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-admin-title">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Platform metrics and recent activity</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map((s, i) => (
            <Card key={i} className="hover-elevate cursor-pointer" data-testid={`card-stat-${s.label.toLowerCase().replace(/\s/g, "-")}`} onClick={() => {
              if (s.label === "Total Users") setActiveSection("users");
              else if (s.label === "Total Projects") setActiveSection("projects");
              else if (s.label === "Pro Subscribers") setActiveSection("subscriptions");
              else if (s.label === "Open Tickets") setActiveSection("tickets");
              else if (s.label === "Submissions") setActiveSection("submissions");
            }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <s.icon className={`w-4.5 h-4.5 ${s.color}`} />
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold" data-testid={`stat-${s.label.toLowerCase().replace(/\s/g, "-")}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                Quick Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Conversion Rate</span>
                <span className="text-sm font-semibold" data-testid="text-conversion-rate">{conversionRate}%</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Avg Projects/User</span>
                <span className="text-sm font-semibold" data-testid="text-avg-projects">
                  {stats && stats.totalUsers > 0 ? (stats.totalProjects / stats.totalUsers).toFixed(1) : "0"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Pending Submissions</span>
                <span className="text-sm font-semibold">
                  {submissions?.filter(s => s.status === "new" || s.status === "reviewing").length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Open Tickets</span>
                <span className="text-sm font-semibold">{stats?.openTickets ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Admin Users</span>
                <span className="text-sm font-semibold">{allUsers?.filter(u => u.role === "admin").length ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity && recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.slice(0, 8).map((a, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        {activityIcon(a.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{a.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.timestamp ? formatDistanceToNow(new Date(a.timestamp), { addSuffix: true }) : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium">Recent Submissions</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveSection("submissions")} data-testid="button-view-all-submissions">
                  View All <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {submissions && submissions.length > 0 ? (
                <div className="space-y-3">
                  {submissions.slice(0, 4).map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{sub.projectName || "Project"}</p>
                        <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                      </div>
                      <Badge variant={statusBadgeVariant(sub.status)}>{sub.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No submissions yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium">Recent Tickets</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveSection("tickets")} data-testid="button-view-all-tickets">
                  View All <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tickets && tickets.length > 0 ? (
                <div className="space-y-3">
                  {tickets.slice(0, 4).map((ticket) => (
                    <div key={ticket.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground">{ticket.userEmail}</p>
                      </div>
                      <Badge variant={statusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No tickets yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  function renderUsers() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Users</h1>
            <p className="text-sm text-muted-foreground mt-1">{allUsers?.length ?? 0} total users</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-users"
            />
          </div>
        </div>

        {loadingUsers ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)}</div>
        ) : filteredUsers && filteredUsers.length > 0 ? (
          <div className="space-y-2">
            {filteredUsers.map((u) => {
              const userProjectCount = allProjects?.filter(p => p.userEmail === u.email).length ?? 0;
              const userSub = allSubscriptions?.find(s => s.userEmail === u.email);
              return (
                <Card key={u.id} data-testid={`card-user-${u.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarFallback className="text-xs">{u.email.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" data-testid={`text-user-email-${u.id}`}>{u.email}</span>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"} data-testid={`badge-role-${u.id}`}>{u.role}</Badge>
                          {userSub?.status === "active" && <Badge variant="outline">Pro</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {userProjectCount} project{userProjectCount !== 1 ? "s" : ""} | ID: {u.id.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Select
                          value={u.role}
                          onValueChange={(role) => toggleRoleMutation.mutate({ userId: u.id, role })}
                        >
                          <SelectTrigger className="w-24" data-testid={`select-role-${u.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm({ type: "user", id: u.id, label: u.email })}
                          disabled={u.id === user?.id}
                          data-testid={`button-delete-user-${u.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">{searchQuery ? "No users match your search" : "No users"}</h3>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  function renderProjects() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">{allProjects?.length ?? 0} total projects</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-projects"
            />
          </div>
        </div>

        {loadingProjects ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)}</div>
        ) : filteredProjects && filteredProjects.length > 0 ? (
          <div className="space-y-2">
            {filteredProjects.map((project) => {
              const blockCount = Array.isArray(project.schema) ? (project.schema as any[]).length : 0;
              return (
                <Card key={project.id} data-testid={`card-admin-project-${project.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <FolderOpen className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">{project.name}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {project.userEmail || "Unknown"} | {blockCount} block{blockCount !== 1 ? "s" : ""}
                          {project.updatedAt ? ` | Updated ${format(new Date(project.updatedAt), "MMM d, yyyy")}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm({ type: "project", id: project.id, label: project.name })}
                        data-testid={`button-delete-project-${project.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">{searchQuery ? "No projects match your search" : "No projects"}</h3>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  function renderSubmissions() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Submissions</h1>
            <p className="text-sm text-muted-foreground mt-1">Review project submissions from users</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search submissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-submissions"
            />
          </div>
        </div>

        {loadingSubs ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
        ) : filteredSubmissions && filteredSubmissions.length > 0 ? (
          <div className="space-y-2">
            {filteredSubmissions.map((sub) => (
              <Card key={sub.id} data-testid={`card-submission-${sub.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm" data-testid={`text-project-${sub.id}`}>{sub.projectName || "Project"}</span>
                        <Badge variant={statusBadgeVariant(sub.status)} data-testid={`badge-status-${sub.id}`}>{sub.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{sub.userEmail || "User"}</p>
                      {sub.notes && <p className="text-sm mt-2 text-muted-foreground">{sub.notes}</p>}
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
              <h3 className="font-medium mb-1">{searchQuery ? "No submissions match" : "No submissions yet"}</h3>
              <p className="text-sm text-muted-foreground">Submissions from users will appear here</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  function renderTickets() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Support Tickets</h1>
            <p className="text-sm text-muted-foreground mt-1">{tickets?.filter(t => t.status === "open").length ?? 0} open tickets</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-tickets"
            />
          </div>
        </div>

        {loadingTickets ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
        ) : filteredTickets && filteredTickets.length > 0 ? (
          <div className="space-y-2">
            {filteredTickets.map((ticket) => (
              <Card key={ticket.id} data-testid={`card-ticket-${ticket.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm">{ticket.subject}</span>
                        <Badge variant={statusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{ticket.userEmail || "User"}</p>
                      <p className="text-sm mt-2 text-muted-foreground">{ticket.message}</p>
                      {ticket.adminReply && (
                        <div className="mt-3 p-3 bg-muted rounded-md">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Admin Reply:</p>
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
              <h3 className="font-medium mb-1">{searchQuery ? "No tickets match" : "No tickets"}</h3>
              <p className="text-sm text-muted-foreground">Support tickets from users will appear here</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  function renderSubscriptions() {
    const activeSubs = allSubscriptions?.filter(s => s.status === "active") ?? [];
    const otherSubs = allSubscriptions?.filter(s => s.status !== "active") ?? [];

    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeSubs.length} active subscription{activeSubs.length !== 1 ? "s" : ""} | {allSubscriptions?.length ?? 0} total
          </p>
        </div>

        {loadingSubs2 ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)}</div>
        ) : allSubscriptions && allSubscriptions.length > 0 ? (
          <div className="space-y-4">
            {activeSubs.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-2">Active</h2>
                <div className="space-y-2">
                  {activeSubs.map((sub) => (
                    <Card key={sub.userId} data-testid={`card-sub-${sub.userId}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="w-9 h-9 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <UserCheck className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{sub.userEmail}</span>
                              <Badge variant="default">Active</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {sub.provider || "razorpay"}
                              {sub.currentPeriodEnd ? ` | Renews ${format(new Date(sub.currentPeriodEnd), "MMM d, yyyy")}` : ""}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {otherSubs.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-2">Other</h2>
                <div className="space-y-2">
                  {otherSubs.map((sub) => (
                    <Card key={sub.userId} data-testid={`card-sub-${sub.userId}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{sub.userEmail}</span>
                              <Badge variant={statusBadgeVariant(sub.status)}>{sub.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {sub.updatedAt ? `Last updated ${format(new Date(sub.updatedAt), "MMM d, yyyy")}` : ""}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">No subscriptions</h3>
              <p className="text-sm text-muted-foreground">Subscription data will appear here when users subscribe</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  function renderAutomations() {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-automations-title">Automations</h1>
          <p className="text-sm text-muted-foreground mt-1">Run maintenance tasks and view execution history</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AUTOMATION_JOBS.map((job) => {
            const Icon = job.icon;
            const lastRun = automationLogs?.find((l) => l.jobName === job.id);
            return (
              <Card key={job.id} data-testid={`card-job-${job.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => runJobMutation.mutate(job.id)}
                      disabled={runJobMutation.isPending}
                      data-testid={`button-run-${job.id}`}
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      {runJobMutation.isPending ? "Running..." : "Run Now"}
                    </Button>
                  </div>
                  <h3 className="font-medium text-sm mb-1">{job.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{job.description}</p>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">Schedule: {job.schedule}</span>
                    {lastRun && (
                      <Badge variant={statusBadgeVariant(lastRun.status)}>{lastRun.status}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-1">Run History</h2>
          <p className="text-sm text-muted-foreground mb-4">Recent automation job executions</p>

          {loadingLogs ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>)}</div>
          ) : automationLogs && automationLogs.length > 0 ? (
            <div className="space-y-2">
              {automationLogs.map((log) => (
                <Card key={log.id} data-testid={`card-log-${log.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {log.status === "success" ? (
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        ) : log.status === "failed" ? (
                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-500 shrink-0 animate-pulse" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{log.jobName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                            <Badge variant={statusBadgeVariant(log.status)}>{log.status}</Badge>
                          </div>
                          {log.message && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.message}</p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {log.startedAt ? format(new Date(log.startedAt), "MMM d, h:mm a") : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          by {log.triggeredBy || "system"}
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
                <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-medium mb-1">No automation history</h3>
                <p className="text-sm text-muted-foreground">Run a job above to see its execution history here</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <div className="p-4 pb-2">
                <Link href="/dashboard" className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <span className="font-semibold text-sm tracking-tight">BuilderPro</span>
                </Link>
                <Badge variant="outline" className="mt-2 text-[10px]">Admin Panel</Badge>
              </div>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => { setActiveSection(item.id); setSearchQuery(""); }}
                        data-active={activeSection === item.id}
                        className="data-[active=true]:bg-sidebar-accent"
                        data-testid={`nav-${item.id}`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-auto">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => navigate("/dashboard")} data-testid="nav-back-dashboard">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Dashboard</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <span className="text-sm font-medium text-muted-foreground">
              {NAV_ITEMS.find(n => n.id === activeSection)?.label || "Overview"}
            </span>
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            {renderContent()}
          </main>
        </div>
      </div>

      <Dialog open={!!replyTicketId} onOpenChange={(open) => { if (!open) { setReplyTicketId(null); setReplyText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to Ticket</DialogTitle>
            <DialogDescription>Write your response to the user's support ticket</DialogDescription>
          </DialogHeader>
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            rows={5}
            data-testid="textarea-reply"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReplyTicketId(null); setReplyText(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (replyTicketId && replyText.trim()) {
                  updateTicketMutation.mutate({ id: replyTicketId, adminReply: replyText.trim(), status: "in_progress" });
                }
              }}
              disabled={!replyText.trim() || updateTicketMutation.isPending}
              data-testid="button-send-reply"
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              {updateTicketMutation.isPending ? "Sending..." : "Send Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {deleteConfirm?.type}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 bg-destructive/10 rounded-md">
            <p className="text-sm font-medium">{deleteConfirm?.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {deleteConfirm?.type === "user" ? "All their projects, submissions, and data will be permanently removed." : "This project and its submissions will be permanently removed."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm?.type === "user") deleteUserMutation.mutate(deleteConfirm.id);
                else if (deleteConfirm?.type === "project") deleteProjectMutation.mutate(deleteConfirm.id);
              }}
              disabled={deleteUserMutation.isPending || deleteProjectMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {(deleteUserMutation.isPending || deleteProjectMutation.isPending) ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
