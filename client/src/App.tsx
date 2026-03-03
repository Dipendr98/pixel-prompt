import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { Loader2 } from "lucide-react";
import Landing from "@/pages/landing";
import AuthLogin from "@/pages/auth-login";
import AuthSignup from "@/pages/auth-signup";
import Dashboard from "@/pages/dashboard";
import Builder from "@/pages/builder";
import Billing from "@/pages/billing";
import AdminSubmissions from "@/pages/admin-submissions";
import MySubmissions from "@/pages/my-submissions";
import Support from "@/pages/support";
import Contact from "@/pages/contact";
import AdminCrm from "@/pages/admin-crm";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function GuestRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/contact" component={Contact} />
      <Route path="/login">
        <GuestRoute component={AuthLogin} />
      </Route>
      <Route path="/signup">
        <GuestRoute component={AuthSignup} />
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/builder/:projectId">
        <ProtectedRoute component={Builder} />
      </Route>
      <Route path="/billing">
        <ProtectedRoute component={Billing} />
      </Route>
      <Route path="/admin/submissions">
        <ProtectedRoute component={AdminSubmissions} />
      </Route>
      <Route path="/admin/crm">
        <ProtectedRoute component={AdminCrm} />
      </Route>
      <Route path="/submissions">
        <ProtectedRoute component={MySubmissions} />
      </Route>
      <Route path="/support">
        <ProtectedRoute component={Support} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <Toaster />
            <Router />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
