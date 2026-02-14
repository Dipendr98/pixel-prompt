import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import type { Submission } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Layers, FileText } from "lucide-react";
import { format } from "date-fns";

type SubmissionWithProject = Submission & { projectName?: string };

export default function MySubmissions() {
  const [, navigate] = useLocation();

  const { data: submissions, isLoading } = useQuery<SubmissionWithProject[]>({
    queryKey: ["/api/submissions"],
  });

  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
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
            <span className="font-semibold tracking-tight">BuilderPro</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-1" data-testid="text-submissions-title">My Submissions</h1>
        <p className="text-sm text-muted-foreground mb-6">Track the status of your project submissions</p>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-5 w-1/2 mb-2" /><Skeleton className="h-4 w-1/3" /></CardContent></Card>
            ))}
          </div>
        ) : submissions && submissions.length > 0 ? (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <Card key={sub.id} data-testid={`card-submission-${sub.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <span className="font-medium">{sub.projectName || "Project"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusColors[sub.status] || "bg-muted"}`}>
                      {sub.status}
                    </span>
                  </div>
                  {sub.notes && <p className="text-sm text-muted-foreground mt-1">{sub.notes}</p>}
                  <p className="text-xs text-muted-foreground mt-2">
                    {sub.createdAt ? format(new Date(sub.createdAt), "MMM d, yyyy") : ""}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">No submissions</h3>
              <p className="text-sm text-muted-foreground">Submit a project from the builder to see it here</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
