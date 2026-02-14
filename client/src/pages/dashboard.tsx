import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Trash2, Pencil, ExternalLink, Layers, CreditCard, LogOut, Shield, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Dashboard() {
  const { user, logout, isPro } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [newProjectName, setNewProjectName] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [renameProject, setRenameProject] = useState<Project | null>(null);
  const [renameName, setRenameName] = useState("");

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/projects", { name, schema: [] });
      return res.json();
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setShowCreateDialog(false);
      setNewProjectName("");
      navigate(`/builder/${project.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project deleted" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiRequest("PATCH", `/api/projects/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setRenameProject(null);
      toast({ title: "Project renamed" });
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
              <Layers className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight" data-testid="text-brand">BuilderPro</span>
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            {isPro && (
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md" data-testid="badge-pro">PRO</span>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/billing")} data-testid="button-billing">
              <CreditCard className="w-4 h-4 mr-1" />
              Billing
            </Button>
            {user?.role === "admin" && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin/submissions")} data-testid="button-admin">
                <Shield className="w-4 h-4 mr-1" />
                Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/submissions")} data-testid="button-my-submissions">
              <FileText className="w-4 h-4 mr-1" />
              Submissions
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Your Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">Build and manage your website projects</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-new-project">
            <Plus className="w-4 h-4 mr-1" />
            New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-5 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card key={project.id} className="hover-elevate cursor-pointer group" data-testid={`card-project-${project.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => navigate(`/builder/${project.id}`)}
                    >
                      <h3 className="font-medium truncate" data-testid={`text-project-name-${project.id}`}>{project.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {project.updatedAt ? format(new Date(project.updatedAt), "MMM d, yyyy") : "Just created"}
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {Array.isArray(project.schema) ? (project.schema as any[]).length : 0} blocks
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-project-menu-${project.id}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/builder/${project.id}`)} data-testid={`menu-open-${project.id}`}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setRenameProject(project); setRenameName(project.name); }} data-testid={`menu-rename-${project.id}`}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(project.id)}
                          data-testid={`menu-delete-${project.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center mb-4">
                <Layers className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-1" data-testid="text-empty-state">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first project to get started</p>
              <Button onClick={() => setShowCreateDialog(true)} data-testid="button-empty-new-project">
                <Plus className="w-4 h-4 mr-1" />
                New Project
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new project</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newProjectName.trim()) createMutation.mutate(newProjectName.trim());
            }}
          >
            <Input
              placeholder="My Awesome Website"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              autoFocus
              data-testid="input-project-name"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={!newProjectName.trim() || createMutation.isPending} data-testid="button-create-project">
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameProject} onOpenChange={() => setRenameProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (renameProject && renameName.trim()) {
                renameMutation.mutate({ id: renameProject.id, name: renameName.trim() });
              }
            }}
          >
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              autoFocus
              data-testid="input-rename"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setRenameProject(null)}>Cancel</Button>
              <Button type="submit" disabled={!renameName.trim() || renameMutation.isPending} data-testid="button-rename">
                Rename
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
