import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layers, Sparkles, Download, MousePointer, ArrowRight, Blocks, Zap } from "lucide-react";

export default function Landing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" className="w-8 h-8 rounded-md" alt="PixelPrompt Logo" />
            <span className="font-semibold tracking-tight" data-testid="text-brand">PixelPrompt</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button onClick={() => navigate("/dashboard")} data-testid="button-go-dashboard">
                Dashboard
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/login")} data-testid="button-header-login">Sign in</Button>
                <Button onClick={() => navigate("/signup")} data-testid="button-header-signup">Get Started</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="max-w-4xl mx-auto px-6 py-24 text-center relative">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-3 py-1 rounded-md mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Website Builder
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-hero-title">
            Build stunning websites<br />without writing code
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Drag, drop, and let AI help you create professional websites in minutes. Export clean HTML & CSS ready for production.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" onClick={() => navigate(user ? "/dashboard" : "/signup")} data-testid="button-cta-start">
              Start Building Free
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate("/login")} data-testid="button-cta-login">
              Sign In
            </Button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold mb-2">Everything you need to build</h2>
          <p className="text-muted-foreground">Powerful features, simple interface</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: MousePointer, title: "Drag & Drop", desc: "Intuitive drag-and-drop interface with live preview. Reorder blocks, edit styles, build fast." },
            { icon: Sparkles, title: "AI Assistant", desc: "Generate sections, hero blocks, and copy with AI. Just describe what you want." },
            { icon: Download, title: "Export to ZIP", desc: "Export your design as clean HTML + CSS files, ready to host anywhere." },
            { icon: Blocks, title: "Component Library", desc: "Pre-built components: heroes, feature grids, text blocks, buttons, and more." },
            { icon: Zap, title: "Auto-Save", desc: "Your work is automatically saved as you build. Never lose progress." },
            { icon: Layers, title: "Team Submissions", desc: "Submit projects for team review with notes and status tracking." },
          ].map((f, i) => (
            <Card key={i} className="hover-elevate">
              <CardContent className="p-6">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            PixelPrompt &mdash; AI-Powered Website Builder
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <Link href="/contact" className="hover:text-primary transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
