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
import { Badge } from "@/components/ui/badge";
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
import { Plus, MoreVertical, Trash2, Pencil, ExternalLink, Layers, CreditCard, LogOut, Shield, FileText, HelpCircle, ShoppingBag, Briefcase, Utensils, Rocket, Globe, Layout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { nanoid } from "nanoid";

const TEMPLATES = [
  { id: "blank", label: "Blank", description: "Start from scratch", icon: Layout, schema: [] },
  { id: "ecommerce", label: "E-Commerce Store", description: "Online shop with products, cart, and pricing", icon: ShoppingBag, schema: "ecommerce" },
  { id: "saas", label: "SaaS Landing", description: "Software product with pricing and features", icon: Rocket, schema: "saas" },
  { id: "portfolio", label: "Portfolio", description: "Showcase your work and skills", icon: Briefcase, schema: "portfolio" },
  { id: "restaurant", label: "Restaurant", description: "Menu, reservations, and gallery", icon: Utensils, schema: "restaurant" },
  { id: "agency", label: "Agency", description: "Services, team, and client testimonials", icon: Globe, schema: "agency" },
];

function getTemplateSchema(templateId: string): any[] {
  const id = () => nanoid(8);

  switch (templateId) {
    case "ecommerce":
      return [
        { id: id(), type: "navbar", props: { brand: "ShopHub", links: [{ label: "Home", url: "#" }, { label: "Products", url: "#" }, { label: "Categories", url: "#" }, { label: "Sale", url: "#" }], ctaText: "Cart (0)" } },
        { id: id(), type: "hero", props: { title: "Discover Amazing Products", subtitle: "Shop our curated collection of premium items. Free shipping on orders over $50.", buttonText: "Shop Now" } },
        { id: id(), type: "banner", props: { text: "FLASH SALE: Use code SAVE20 for 20% off everything!", linkText: "Shop Now", variant: "info" } },
        { id: id(), type: "heading", props: { text: "Featured Products", align: "center" } },
        { id: id(), type: "product-card", props: { products: [{ name: "Wireless Headphones", price: "$79.99", description: "Premium noise-cancelling headphones", image: "" }, { name: "Smart Watch Pro", price: "$199.99", description: "Track fitness and notifications", image: "" }, { name: "Portable Speaker", price: "$49.99", description: "Waterproof Bluetooth speaker", image: "" }] } },
        { id: id(), type: "features", props: { features: [{ title: "Free Shipping", desc: "On orders over $50" }, { title: "Easy Returns", desc: "30-day money back guarantee" }, { title: "Secure Payment", desc: "256-bit SSL encryption" }] } },
        { id: id(), type: "testimonials", props: { testimonials: [{ name: "Emma W.", role: "Verified Buyer", quote: "Amazing quality and fast shipping!" }, { name: "David L.", role: "Verified Buyer", quote: "Best online shopping experience." }, { name: "Sarah M.", role: "Verified Buyer", quote: "Love the product! Exactly as described." }] } },
        { id: id(), type: "newsletter", props: { title: "Join Our Newsletter", subtitle: "Get exclusive deals and 10% off your first order", buttonText: "Subscribe" } },
        { id: id(), type: "footer", props: { columns: [{ title: "Shop", links: ["New Arrivals", "Best Sellers", "Sale"] }, { title: "Help", links: ["Shipping", "Returns", "Track Order"] }, { title: "Company", links: ["About", "Careers", "Blog"] }], copyright: "2025 ShopHub. All rights reserved." } },
      ];
    case "saas":
      return [
        { id: id(), type: "navbar", props: { brand: "CloudApp", links: [{ label: "Features", url: "#" }, { label: "Pricing", url: "#" }, { label: "Docs", url: "#" }, { label: "Blog", url: "#" }], ctaText: "Start Free Trial" } },
        { id: id(), type: "hero", props: { title: "The Smarter Way to Build Products", subtitle: "Streamline your workflow, collaborate in real-time, and ship faster.", buttonText: "Start Free Trial" } },
        { id: id(), type: "logo-cloud", props: { title: "Powering teams at leading companies", logos: ["Slack", "Notion", "Figma", "Linear", "Vercel"] } },
        { id: id(), type: "features", props: { features: [{ title: "Real-time Collaboration", desc: "Work together seamlessly" }, { title: "Powerful Analytics", desc: "Deep insights into performance" }, { title: "Enterprise Security", desc: "SOC 2 compliant with encryption" }] } },
        { id: id(), type: "stats", props: { stats: [{ value: "10K+", label: "Companies" }, { value: "99.9%", label: "Uptime" }, { value: "50M+", label: "API Calls/Day" }, { value: "150+", label: "Countries" }] } },
        { id: id(), type: "pricing-table", props: { plans: [{ name: "Starter", price: "$0/mo", features: ["5 users", "Basic analytics", "Community support"], highlighted: false }, { name: "Pro", price: "$29/mo", features: ["Unlimited users", "Advanced analytics", "Priority support", "API access"], highlighted: true }, { name: "Enterprise", price: "Custom", features: ["Everything in Pro", "Dedicated manager", "Custom SLA", "SSO"], highlighted: false }] } },
        { id: id(), type: "testimonials", props: { testimonials: [{ name: "Katie M.", role: "VP Engineering", quote: "Cut our dev cycle by 60%." }, { name: "Ryan J.", role: "CTO", quote: "Best developer tool this year." }, { name: "Laura S.", role: "Product Lead", quote: "Finally delivers on its promises." }] } },
        { id: id(), type: "faq", props: { title: "Frequently Asked Questions", items: [{ question: "Can I try it for free?", answer: "Yes! Starter plan is free, no credit card required." }, { question: "How does billing work?", answer: "Monthly or annual (save 20%). Cancel anytime." }, { question: "Is my data secure?", answer: "SOC 2 Type II compliant with 256-bit encryption." }] } },
        { id: id(), type: "cta", props: { title: "Ready to Transform Your Workflow?", subtitle: "Join 10,000+ teams already using CloudApp", primaryButton: "Start Free Trial", secondaryButton: "Talk to Sales" } },
        { id: id(), type: "footer", props: { columns: [{ title: "Product", links: ["Features", "Pricing", "Changelog"] }, { title: "Resources", links: ["Docs", "API", "Community"] }, { title: "Company", links: ["About", "Careers", "Contact"] }], copyright: "2025 CloudApp. All rights reserved." } },
      ];
    case "portfolio":
      return [
        { id: id(), type: "navbar", props: { brand: "Alex Design", links: [{ label: "Work", url: "#" }, { label: "About", url: "#" }, { label: "Services", url: "#" }, { label: "Contact", url: "#" }], ctaText: "Hire Me" } },
        { id: id(), type: "hero", props: { title: "Creative Designer & Developer", subtitle: "I craft beautiful digital experiences that connect brands with their audience.", buttonText: "View My Work" } },
        { id: id(), type: "logo-cloud", props: { title: "Trusted by amazing brands", logos: ["Google", "Spotify", "Netflix", "Airbnb", "Stripe"] } },
        { id: id(), type: "heading", props: { text: "Featured Projects", align: "center" } },
        { id: id(), type: "gallery", props: { count: 6 } },
        { id: id(), type: "features", props: { features: [{ title: "UI/UX Design", desc: "Beautiful interfaces that delight users" }, { title: "Web Development", desc: "Fast, responsive modern websites" }, { title: "Brand Identity", desc: "Logos and guidelines that define your brand" }] } },
        { id: id(), type: "stats", props: { stats: [{ value: "100+", label: "Projects" }, { value: "50+", label: "Clients" }, { value: "8+", label: "Years" }, { value: "15", label: "Awards" }] } },
        { id: id(), type: "testimonials", props: { testimonials: [{ name: "Mark Z.", role: "Startup Founder", quote: "Increased our conversions by 40%." }, { name: "Anna P.", role: "Marketing Director", quote: "Incredible eye for detail." }, { name: "Tom H.", role: "Product Manager", quote: "Delivered above quality standards." }] } },
        { id: id(), type: "cta", props: { title: "Let's Work Together", subtitle: "Have a project in mind? I'd love to hear about it.", primaryButton: "Get in Touch", secondaryButton: "View Resume" } },
        { id: id(), type: "social-links", props: { links: [{ platform: "Dribbble", url: "#" }, { platform: "Behance", url: "#" }, { platform: "GitHub", url: "#" }, { platform: "LinkedIn", url: "#" }] } },
      ];
    case "restaurant":
      return [
        { id: id(), type: "navbar", props: { brand: "Bella Cucina", links: [{ label: "Menu", url: "#" }, { label: "About", url: "#" }, { label: "Gallery", url: "#" }, { label: "Contact", url: "#" }], ctaText: "Reserve Table" } },
        { id: id(), type: "hero", props: { title: "Authentic Italian Cuisine", subtitle: "Experience the finest handcrafted dishes made with fresh, locally-sourced ingredients.", buttonText: "View Menu" } },
        { id: id(), type: "heading", props: { text: "Our Signature Dishes", align: "center" } },
        { id: id(), type: "product-card", props: { products: [{ name: "Truffle Risotto", price: "$28", description: "Arborio rice with wild mushrooms and black truffle", image: "" }, { name: "Grilled Sea Bass", price: "$34", description: "Fresh catch with lemon butter and capers", image: "" }, { name: "Tiramisu", price: "$14", description: "Classic Italian dessert with espresso and mascarpone", image: "" }] } },
        { id: id(), type: "stats", props: { stats: [{ value: "15+", label: "Years" }, { value: "200+", label: "Menu Items" }, { value: "50K+", label: "Happy Diners" }, { value: "4.9", label: "Rating" }] } },
        { id: id(), type: "gallery", props: { count: 6 } },
        { id: id(), type: "testimonials", props: { testimonials: [{ name: "Michael B.", role: "Food Critic", quote: "One of the finest Italian restaurants in the city." }, { name: "Jennifer L.", role: "Regular Guest", quote: "Consistently excellent. Our go-to date night spot." }, { name: "Robert K.", role: "Chef", quote: "The passion for authentic flavors shines through." }] } },
        { id: id(), type: "contact-form", props: { title: "Make a Reservation", subtitle: "Call us or fill out the form below", buttonText: "Reserve Now" } },
        { id: id(), type: "footer", props: { columns: [{ title: "Hours", links: ["Mon-Thu: 11am-10pm", "Fri-Sat: 11am-11pm", "Sun: 12pm-9pm"] }, { title: "Contact", links: ["(555) 123-4567", "info@bellacucina.com"] }, { title: "Follow Us", links: ["Instagram", "Facebook"] }], copyright: "2025 Bella Cucina. All rights reserved." } },
      ];
    case "agency":
      return [
        { id: id(), type: "navbar", props: { brand: "Catalyst Agency", links: [{ label: "Services", url: "#" }, { label: "Work", url: "#" }, { label: "Team", url: "#" }, { label: "Blog", url: "#" }], ctaText: "Get a Quote" } },
        { id: id(), type: "hero", props: { title: "We Build Brands That Matter", subtitle: "Full-service digital agency specializing in strategy, design, and growth marketing.", buttonText: "View Our Work" } },
        { id: id(), type: "features", props: { features: [{ title: "Brand Strategy", desc: "Data-driven positioning for your audience" }, { title: "Digital Marketing", desc: "SEO, PPC, and content that drives results" }, { title: "Web Development", desc: "Custom sites built for performance" }] } },
        { id: id(), type: "stats", props: { stats: [{ value: "200+", label: "Projects" }, { value: "98%", label: "Retention" }, { value: "5x", label: "Average ROI" }, { value: "12", label: "Team Members" }] } },
        { id: id(), type: "team", props: { members: [{ name: "Alex Rivera", role: "Creative Director", bio: "15 years of brand strategy" }, { name: "Jordan Lee", role: "Lead Developer", bio: "Full-stack expert" }, { name: "Maya Chen", role: "Marketing Head", bio: "Growth specialist" }, { name: "Chris Park", role: "UX Designer", bio: "Human-centered design" }] } },
        { id: id(), type: "logo-cloud", props: { title: "Brands we've worked with", logos: ["Nike", "Apple", "Google", "Amazon", "Microsoft"] } },
        { id: id(), type: "testimonials", props: { testimonials: [{ name: "James R.", role: "CEO", quote: "Revenue increased 300% in 6 months." }, { name: "Maria S.", role: "CMO", quote: "Most strategic agency we've worked with." }, { name: "David K.", role: "Founder", quote: "They deliver growth, not just projects." }] } },
        { id: id(), type: "contact-form", props: { title: "Start Your Project", subtitle: "Tell us about your goals", buttonText: "Submit Inquiry" } },
        { id: id(), type: "footer", props: { columns: [{ title: "Services", links: ["Branding", "Web Design", "SEO", "Content"] }, { title: "Company", links: ["About", "Team", "Careers"] }, { title: "Contact", links: ["hello@catalyst.com", "(555) 987-6543"] }], copyright: "2025 Catalyst Agency. All rights reserved." } },
      ];
    default:
      return [];
  }
}

export default function Dashboard() {
  const { user, logout, isPro } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [renameProject, setRenameProject] = useState<Project | null>(null);
  const [renameName, setRenameName] = useState("");

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, schema }: { name: string; schema: any[] }) => {
      const res = await apiRequest("POST", "/api/projects", { name, schema });
      return res.json();
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setShowCreateDialog(false);
      setNewProjectName("");
      setSelectedTemplate("blank");
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

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    const schema = getTemplateSchema(selectedTemplate);
    createMutation.mutate({ name: newProjectName.trim(), schema });
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
            <Button variant="ghost" size="sm" onClick={() => navigate("/support")} data-testid="button-support">
              <HelpCircle className="w-4 h-4 mr-1" />
              Support
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create new project</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateProject();
            }}
          >
            <Input
              placeholder="My Awesome Website"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              autoFocus
              className="mb-4"
              data-testid="input-project-name"
            />

            <p className="text-sm font-medium mb-2">Choose a template</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {TEMPLATES.map((t) => {
                const Icon = t.icon;
                const isSelected = selectedTemplate === t.id;
                return (
                  <div
                    key={t.id}
                    className={`p-3 rounded-md border-2 cursor-pointer transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setSelectedTemplate(t.id)}
                    data-testid={`template-${t.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">{t.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{t.description}</p>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
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
