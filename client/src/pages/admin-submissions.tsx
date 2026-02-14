import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Submission } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Layers, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type SubmissionWithDetails = Submission & { projectName?: string; userEmail?: string };

export default function AdminSubmissions() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: submissions, isLoading } = useQuery<SubmissionWithDetails[]>({
    queryKey: ["/api/admin/submissions"],
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
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto flex items-center gap-4 px-6 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
              <Layers className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">BuilderPro</span>
          </Link>
          <Badge variant="outline" className="ml-auto">Admin</Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-1" data-testid="text-admin-title">All Submissions</h1>
        <p className="text-sm text-muted-foreground mb-6">Review and manage team submissions</p>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-5 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
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
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">No submissions yet</h3>
              <p className="text-sm text-muted-foreground">Submissions from users will appear here</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
