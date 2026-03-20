import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, ComponentBlock, PageData, ProjectData, ProjectSettings } from "@shared/schema";
import { migrateProjectSchema } from "@shared/schema";
import { buildPreviewHtml } from "@/lib/preview";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { nanoid } from "nanoid";
import { ComponentLibrary } from "@/components/builder/component-library";
import { CanvasBlock } from "@/components/builder/canvas-block";
import { PropertiesPanel } from "@/components/builder/properties-panel";
import { AiPanel } from "@/components/builder/ai-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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
import {
  Layers,
  ArrowLeft,
  Undo2,
  Redo2,
  Download,
  Send,
  Save,
  Settings,
  Sparkles,
  Loader2,
  Plus,
  Monitor,
  Tablet,
  Smartphone,
  FileText,
  MoreVertical,
  Trash2,
  Pencil,
  Palette,
  Search,
  X,
  Eye,
  Globe,
  RefreshCw,
} from "lucide-react";

// --- Viewport Presets ---
const VIEWPORTS = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: "100%" },
  { id: "tablet", label: "Tablet", icon: Tablet, width: "768px" },
  { id: "mobile", label: "Mobile", icon: Smartphone, width: "375px" },
] as const;

// --- Default Google Fonts ---
const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Poppins", label: "Poppins" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Lato", label: "Lato" },
  { value: "Outfit", label: "Outfit" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Merriweather", label: "Merriweather" },
  { value: "Source Sans Pro", label: "Source Sans Pro" },
  { value: "system-ui", label: "System Default" },
];

function CanvasDropZone({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onAddBlock,
  viewport,
  settings,
}: {
  blocks: ComponentBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onDeleteBlock: (id: string) => void;
  onAddBlock: (type: string) => void;
  viewport: string;
  settings: ProjectSettings;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-drop-zone" });
  const viewportObj = VIEWPORTS.find((v) => v.id === viewport) || VIEWPORTS[0];

  const canvasStyle: React.CSSProperties = {
    maxWidth: viewportObj.width,
    margin: "0 auto",
    transition: "max-width 0.3s ease",
    fontFamily: settings.fontFamily || "inherit",
  };

  return (
    <div
      ref={setNodeRef}
      className="flex-1 overflow-auto bg-muted/30"
      onClick={() => onSelectBlock(null)}
    >
      <div style={canvasStyle} className="p-6 min-h-full">
        {blocks.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-md transition-colors ${isOver ? "border-primary bg-primary/5" : "border-border"
              }`}
          >
            <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center mb-4">
              <Layers className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1" data-testid="text-empty-canvas">
              {isOver ? "Drop here to add" : "Start building this page"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              Drag components from the left panel or use AI to generate sections
            </p>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <Button variant="outline" size="sm" onClick={() => onAddBlock("hero")} data-testid="button-add-hero">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Hero
              </Button>
              <Button variant="outline" size="sm" onClick={() => onAddBlock("navbar")} data-testid="button-add-navbar">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Navbar
              </Button>
              <Button variant="outline" size="sm" onClick={() => onAddBlock("product-card")} data-testid="button-add-product">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Products
              </Button>
              <Button variant="outline" size="sm" onClick={() => onAddBlock("contact-form")} data-testid="button-add-contact">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Contact
              </Button>
              <Button variant="outline" size="sm" onClick={() => onAddBlock("blog-list")} data-testid="button-add-blog">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Blog
              </Button>
              <Button variant="outline" size="sm" onClick={() => onAddBlock("footer")} data-testid="button-add-footer">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Footer
              </Button>
            </div>
          </div>
        ) : (
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {blocks.map((block) => (
                <CanvasBlock
                  key={block.id}
                  block={block}
                  isSelected={selectedBlockId === block.id}
                  onSelect={() => onSelectBlock(block.id)}
                  onDelete={() => onDeleteBlock(block.id)}
                />
              ))}
            </div>
            <div
              className={`mt-4 border-2 border-dashed rounded-md p-4 text-center transition-colors ${isOver ? "border-primary bg-primary/5" : "border-transparent hover:border-border"
                }`}
            >
              <p className="text-xs text-muted-foreground">
                {isOver ? "Drop here to add at bottom" : "Drag more components here"}
              </p>
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

function createDefaultBlock(type: string): ComponentBlock {
  const id = nanoid(8);
  const defaults: Record<string, any> = {
    hero: { title: "Welcome to Your Website", subtitle: "Build something amazing with our drag-and-drop builder", buttonText: "Get Started" },
    // Use file-based hrefs so exported ZIP navigation works (index.html, about.html, contact.html, etc.)
    navbar: { brand: "MyBrand", links: [{ label: "Home", url: "index.html" }, { label: "About", url: "about.html" }, { label: "Contact", url: "contact.html" }], ctaText: "Sign Up" },
    footer: { columns: [{ title: "Company", links: ["About", "Careers", "Blog"] }, { title: "Support", links: ["Help Center", "Contact", "FAQ"] }, { title: "Legal", links: ["Privacy", "Terms", "Cookies"] }], copyright: "2025 Your Company. All rights reserved." },
    section: { title: "New Section" },
    heading: { text: "Heading", align: "left" },
    text: { text: "Add your content here. This is a paragraph block that you can customize.", align: "left" },
    button: { text: "Click Me", url: "#", align: "left" },
    image: { src: "", alt: "Image", height: "200px" },
    divider: {},
    spacer: { height: "40px" },
    features: { features: [{ title: "Feature 1", desc: "Description of feature one" }, { title: "Feature 2", desc: "Description of feature two" }, { title: "Feature 3", desc: "Description of feature three" }] },
    "product-card": { products: [{ name: "Product 1", price: "$29.99", description: "Amazing product", image: "" }, { name: "Product 2", price: "$49.99", description: "Premium quality", image: "" }, { name: "Product 3", price: "$19.99", description: "Best seller", image: "" }] },
    "pricing-table": { plans: [{ name: "Basic", price: "$9/mo", features: ["5 Products", "Basic Analytics", "Email Support"], highlighted: false }, { name: "Pro", price: "$29/mo", features: ["Unlimited Products", "Advanced Analytics", "Priority Support", "Custom Domain"], highlighted: true }, { name: "Enterprise", price: "$99/mo", features: ["Everything in Pro", "Dedicated Manager", "SLA", "API Access"], highlighted: false }] },
    "contact-form": { title: "Get in Touch", subtitle: "We'd love to hear from you", buttonText: "Send Message" },
    testimonials: { testimonials: [{ name: "Sarah J.", role: "CEO", quote: "This product changed our business completely!" }, { name: "Mike R.", role: "Designer", quote: "The best tool I've used in my career." }, { name: "Lisa K.", role: "Developer", quote: "Incredible experience from start to finish!" }] },
    gallery: { count: 8 },
    video: { url: "", height: "300px" },
    faq: { title: "Frequently Asked Questions", items: [{ question: "What is your return policy?", answer: "30-day money-back guarantee." }, { question: "How long does shipping take?", answer: "3-5 business days." }, { question: "Do you offer support?", answer: "Yes, 24/7 via chat and email." }] },
    stats: { stats: [{ value: "10K+", label: "Customers" }, { value: "99.9%", label: "Uptime" }, { value: "50+", label: "Countries" }, { value: "24/7", label: "Support" }] },
    team: { members: [{ name: "John Doe", role: "CEO", bio: "Visionary leader" }, { name: "Jane Smith", role: "CTO", bio: "Tech innovator" }, { name: "Alex Chen", role: "Designer", bio: "Creative mind" }, { name: "Sam Wilson", role: "Marketing", bio: "Growth expert" }] },
    "social-links": { links: [{ platform: "Twitter", url: "#" }, { platform: "Facebook", url: "#" }, { platform: "Instagram", url: "#" }, { platform: "LinkedIn", url: "#" }] },
    banner: { text: "Special offer: Get 20% off today!", linkText: "Shop Now", variant: "info" },
    countdown: { title: "Coming Soon", subtitle: "Something amazing is on the way", targetDate: "" },
    newsletter: { title: "Stay Updated", subtitle: "Subscribe to our newsletter for the latest updates", buttonText: "Subscribe" },
    "logo-cloud": { title: "Trusted by leading companies", logos: ["Company A", "Company B", "Company C", "Company D", "Company E"] },
    cta: { title: "Ready to Get Started?", subtitle: "Join thousands of satisfied customers today", primaryButton: "Get Started", secondaryButton: "Learn More" },
    // New component defaults
    "blog-post": { title: "Blog Post Title", excerpt: "This is a preview of the blog post content...", author: "Author Name", date: "2025-01-15", image: "", category: "General" },
    "blog-list": { title: "Latest Posts", posts: [{ title: "Getting Started with Web Design", excerpt: "Learn the basics of modern web design...", author: "Sarah", date: "2025-01-15", category: "Design" }, { title: "Top 10 SEO Tips for 2025", excerpt: "Boost your search rankings with these proven strategies...", author: "Mike", date: "2025-01-10", category: "Marketing" }, { title: "How to Build an Online Store", excerpt: "Step-by-step guide to launching your e-commerce business...", author: "Lisa", date: "2025-01-05", category: "E-Commerce" }] },
    cart: { items: [{ name: "Sample Product", price: "$29.99", quantity: 1, image: "" }], showCheckout: true },
    "checkout-form": { title: "Checkout", subtitle: "Complete your purchase", buttonText: "Place Order", fields: ["name", "email", "address", "card"] },
    map: { address: "New York, NY", zoom: 13, height: "300px" },
    "booking-form": { title: "Book an Appointment", subtitle: "Choose your preferred date and time", buttonText: "Book Now", services: ["Consultation", "Session", "Meeting"] },
    "login-form": { title: "Welcome Back", subtitle: "Sign in to your account", buttonText: "Sign In", showSignup: true },
  };
  return { id, type: type as ComponentBlock["type"], props: defaults[type] || {} };
}

// --- Style Settings Panel ---
function StyleSettingsPanel({
  settings,
  onChange,
}: {
  settings: ProjectSettings;
  onChange: (settings: ProjectSettings) => void;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Palette className="w-4 h-4" /> Global Colors
          </h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Primary Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.primaryColor || "#3b82f6"}
                  onChange={(e) => onChange({ ...settings, primaryColor: e.target.value })}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <Input
                  value={settings.primaryColor || "#3b82f6"}
                  onChange={(e) => onChange({ ...settings, primaryColor: e.target.value })}
                  className="flex-1 text-xs"
                  placeholder="#3b82f6"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Secondary Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.secondaryColor || "#10b981"}
                  onChange={(e) => onChange({ ...settings, secondaryColor: e.target.value })}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <Input
                  value={settings.secondaryColor || "#10b981"}
                  onChange={(e) => onChange({ ...settings, secondaryColor: e.target.value })}
                  className="flex-1 text-xs"
                  placeholder="#10b981"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Accent Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.accentColor || "#f59e0b"}
                  onChange={(e) => onChange({ ...settings, accentColor: e.target.value })}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <Input
                  value={settings.accentColor || "#f59e0b"}
                  onChange={(e) => onChange({ ...settings, accentColor: e.target.value })}
                  className="flex-1 text-xs"
                  placeholder="#f59e0b"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Typography</h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Body Font</Label>
              <select
                value={settings.fontFamily || "Inter"}
                onChange={(e) => onChange({ ...settings, fontFamily: e.target.value })}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Heading Font</Label>
              <select
                value={settings.headingFont || "Inter"}
                onChange={(e) => onChange({ ...settings, headingFont: e.target.value })}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Custom CSS</h3>
          <Textarea
            value={settings.customCSS || ""}
            onChange={(e) => onChange({ ...settings, customCSS: e.target.value })}
            placeholder="/* Add custom CSS here */"
            className="text-xs font-mono min-h-[100px] resize-none"
          />
        </div>
      </div>
    </ScrollArea>
  );
}

// --- SEO Settings Panel ---
function SeoSettingsPanel({
  page,
  onChange,
}: {
  page: PageData;
  onChange: (seo: PageData["seo"]) => void;
}) {
  const seo = page.seo || {};
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Search className="w-4 h-4" /> SEO Settings — {page.name}
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Page Title</Label>
            <Input
              value={seo.title || ""}
              onChange={(e) => onChange({ ...seo, title: e.target.value })}
              placeholder="My Awesome Page"
              className="text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Meta Description</Label>
            <Textarea
              value={seo.description || ""}
              onChange={(e) => onChange({ ...seo, description: e.target.value })}
              placeholder="A brief description of this page for search engines..."
              className="text-xs resize-none min-h-[60px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">OG Image URL</Label>
            <Input
              value={seo.ogImage || ""}
              onChange={(e) => onChange({ ...seo, ogImage: e.target.value })}
              placeholder="https://example.com/og-image.jpg"
              className="text-xs"
            />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

export default function Builder() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { isPro } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Multi-page state
  const [projectData, setProjectData] = useState<ProjectData>({
    pages: [{ id: "home", name: "Home", path: "/", blocks: [], seo: {} }],
    settings: {},
  });
  const [currentPageId, setCurrentPageId] = useState<string>("home");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [history, setHistory] = useState<ProjectData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitNotes, setSubmitNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [viewport, setViewport] = useState("desktop");
  const [showAddPageDialog, setShowAddPageDialog] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [renamePageId, setRenamePageId] = useState<string | null>(null);
  const [renamePageName, setRenamePageName] = useState("");
  const [rightTab, setRightTab] = useState("properties");
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  const saveTimeoutRef = useRef<any>(null);
  const initialLoadRef = useRef(false);

  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });

  useEffect(() => {
    if (!projectId) {
      toast({ title: "Missing project", description: "Please open a project from the dashboard.", variant: "destructive" });
      navigate("/dashboard");
      return;
    }

    // If the project fetch fails (e.g. 404), don't allow export with an invalid projectId.
    if (!isLoading && error) {
      const msg = (error as any)?.message || "Project not found";
      toast({ title: "Export unavailable", description: msg, variant: "destructive" });
      navigate("/dashboard");
    }
  }, [error, isLoading, navigate, projectId, toast]);

  useEffect(() => {
    if (project && !initialLoadRef.current) {
      const data = migrateProjectSchema(project.schema);
      setProjectData(data);
      setCurrentPageId(data.pages[0]?.id || "home");
      setHistory([data]);
      setHistoryIndex(0);
      initialLoadRef.current = true;
      // Normalize navbar links for static ZIP navigation (index.html, contact.html, etc.)
      autoLinkNavbars(data);
    }
  }, [project]);

  const currentPage = projectData.pages.find((p) => p.id === currentPageId) || projectData.pages[0];
  const blocks = currentPage?.blocks || [];

  const pushHistory = useCallback((newData: ProjectData) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newData];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const updateProjectData = useCallback((newData: ProjectData, skipHistory = false) => {
    setProjectData(newData);
    if (!skipHistory) pushHistory(newData);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await apiRequest("PATCH", `/api/projects/${projectId}`, { schema: newData });
      } catch { }
      setIsSaving(false);
    }, 1000);
  }, [projectId, pushHistory]);

  const updateCurrentPageBlocks = useCallback((newBlocks: ComponentBlock[]) => {
    const newData: ProjectData = {
      ...projectData,
      pages: projectData.pages.map((p) =>
        p.id === currentPageId ? { ...p, blocks: newBlocks } : p
      ),
    };
    updateProjectData(newData);
  }, [projectData, currentPageId, updateProjectData]);

  const updateSettings = useCallback((newSettings: ProjectSettings) => {
    const newData: ProjectData = { ...projectData, settings: newSettings };
    updateProjectData(newData);
  }, [projectData, updateProjectData]);

  const updatePageSeo = useCallback((seo: PageData["seo"]) => {
    const newData: ProjectData = {
      ...projectData,
      pages: projectData.pages.map((p) =>
        p.id === currentPageId ? { ...p, seo } : p
      ),
    };
    updateProjectData(newData);
  }, [projectData, currentPageId, updateProjectData]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setProjectData(history[newIndex]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setProjectData(history[newIndex]);
    }
  }, [history, historyIndex]);

  // Page management
  const addPage = useCallback((name: string) => {
    const id = nanoid(8);
    const path = "/" + name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const newPage: PageData = { id, name, path, blocks: [], seo: {} };
    const newData: ProjectData = {
      ...projectData,
      pages: [...projectData.pages, newPage],
    };
    updateProjectData(newData);
    setCurrentPageId(id);
    // Auto-update navbar links on all pages
    autoLinkNavbars(newData);
  }, [projectData, updateProjectData]);

  const deletePage = useCallback((pageId: string) => {
    if (projectData.pages.length <= 1) {
      toast({ title: "Cannot delete", description: "You need at least one page", variant: "destructive" });
      return;
    }
    const newPages = projectData.pages.filter((p) => p.id !== pageId);
    const newData: ProjectData = { ...projectData, pages: newPages };
    if (currentPageId === pageId) {
      setCurrentPageId(newPages[0].id);
    }
    updateProjectData(newData);
    autoLinkNavbars(newData);
  }, [projectData, currentPageId, updateProjectData, toast]);

  const renamePage = useCallback((pageId: string, newName: string) => {
    const newPath = "/" + newName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const newData: ProjectData = {
      ...projectData,
      pages: projectData.pages.map((p) =>
        p.id === pageId ? { ...p, name: newName, path: p.id === "home" ? "/" : newPath } : p
      ),
    };
    updateProjectData(newData);
    autoLinkNavbars(newData);
  }, [projectData, updateProjectData]);

  const pagePathToHref = useCallback((pagePath: string) => {
    if (!pagePath || pagePath === "/") return "index.html";
    const cleaned = pagePath.replace(/^\//, "");
    return `${cleaned}.html`;
  }, []);

  const autoLinkNavbars = useCallback((data: ProjectData) => {
    const pageLinks = data.pages.map((p) => ({
      label: p.name,
      url: pagePathToHref(p.path),
    }));
    const newData: ProjectData = {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        blocks: page.blocks.map((block) => {
          if (block.type === "navbar") {
            return { ...block, props: { ...block.props, links: pageLinks } };
          }
          return block;
        }),
      })),
    };
    setProjectData(newData);
    // Save without pushing to history again
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await apiRequest("PATCH", `/api/projects/${projectId}`, { schema: newData });
      } catch { }
      setIsSaving(false);
    }, 1000);
  }, [projectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;

    if (activeData?.fromLibrary) {
      const newBlock = createDefaultBlock(activeData.type);
      // If adding navbar, auto-populate with page links
      if (activeData.type === "navbar") {
        const pageLinks = projectData.pages.map((p) => ({ label: p.name, url: pagePathToHref(p.path) }));
        newBlock.props = { ...newBlock.props, links: pageLinks };
      }
      const newBlocks = [...blocks];
      if (over.id === "canvas-drop-zone") {
        newBlocks.push(newBlock);
      } else {
        const overIndex = blocks.findIndex((b) => b.id === over.id);
        if (overIndex >= 0) {
          newBlocks.splice(overIndex + 1, 0, newBlock);
        } else {
          newBlocks.push(newBlock);
        }
      }
      updateCurrentPageBlocks(newBlocks);
      setSelectedBlockId(newBlock.id);
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        updateCurrentPageBlocks(arrayMove(blocks, oldIndex, newIndex));
      }
    }
  };

  const handleBlockUpdate = (updated: ComponentBlock) => {
    const newBlocks = blocks.map((b) => (b.id === updated.id ? updated : b));
    updateCurrentPageBlocks(newBlocks);
  };

  const handleDeleteBlock = (id: string) => {
    const newBlocks = blocks.filter((b) => b.id !== id);
    if (selectedBlockId === id) setSelectedBlockId(null);
    updateCurrentPageBlocks(newBlocks);
  };

  const handleApplyAiBlocks = (newBlocks: ComponentBlock[]) => {
    const withIds = newBlocks.map((b) => ({ ...b, id: b.id || nanoid(8) }));
    updateCurrentPageBlocks([...blocks, ...withIds]);
    toast({ title: "Blocks applied", description: `${withIds.length} block(s) added to canvas` });
  };

  // If the AI user prompt targets a specific page (e.g. "page name: Contact"),
  // generate blocks and apply them to that page inside the same project.
  const handleApplyAiBlocksToPage = useCallback(
    (pageName: string, newBlocks: ComponentBlock[]) => {
      const cleanName = pageName.trim();
      const withIds = newBlocks.map((b) => ({ ...b, id: b.id || nanoid(8) }));
      const finalBlocks =
        withIds.some((b) => b.type === "navbar") ? withIds : [createDefaultBlock("navbar"), ...withIds];
      if (!cleanName) {
        updateCurrentPageBlocks([...blocks, ...finalBlocks]);
        toast({ title: "Blocks applied", description: `${finalBlocks.length} block(s) added to canvas` });
        return;
      }

      const newPath =
        "/" + cleanName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      const existing =
        projectData.pages.find((p) => p.path === newPath) ||
        projectData.pages.find((p) => p.name.toLowerCase() === cleanName.toLowerCase());

      const targetId = existing?.id ?? nanoid(8);

      const newPages = existing
        ? projectData.pages.map((p) => (p.id === targetId ? { ...p, blocks: finalBlocks } : p))
        : [
            ...projectData.pages,
            { id: targetId, name: cleanName, path: newPath, blocks: finalBlocks, seo: {} },
          ];

      const newData: ProjectData = { ...projectData, pages: newPages };
      setCurrentPageId(targetId);
      setSelectedBlockId(finalBlocks[0]?.id ?? null);
      updateProjectData(newData);
      autoLinkNavbars(newData);

      toast({
        title: existing ? "Page updated" : "Page created",
        description: `Applied ${finalBlocks.length} block(s) to "${cleanName}".`,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [autoLinkNavbars, blocks, projectData, toast, updateCurrentPageBlocks, updateProjectData]
  );

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/export/${projectId}`, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = "project.zip";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }

      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast({ title: "Export Started", description: "Your basic HTML download should begin shortly." }),
    onError: (error: Error) => toast({ title: "Export Failed", description: error.message, variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async (notes: string) => {
      await apiRequest("POST", "/api/submissions", { projectId, notes });
    },
    onSuccess: () => {
      setShowSubmitDialog(false);
      setSubmitNotes("");
      toast({ title: "Submitted!", description: "Your project has been submitted for review" });
    },
    onError: (err: any) => {
      toast({ title: "Submit failed", description: err.message, variant: "destructive" });
    },
  });

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col bg-background">
        <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Welcome to Advanced Website Builder
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <p className="text-muted-foreground text-sm leading-relaxed">
                You are now using our advanced website builder with multiple AI agents!
                Drag and drop components from the left, or use the AI panel to instantly
                generate sections and smart layouts.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowWelcomeDialog(false)}>
                Start Building
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Top toolbar */}
        <header className="border-b bg-card flex items-center justify-between gap-2 px-3 py-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary shrink-0">
              <Layers className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-medium text-sm truncate" data-testid="text-project-name">{project?.name || "Project"}</span>
            {isSaving && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Saving</span>}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {/* Viewport Toggle */}
            <div className="flex items-center border rounded-md mr-2">
              {VIEWPORTS.map((v) => (
                <Button
                  key={v.id}
                  variant={viewport === v.id ? "default" : "ghost"}
                  size="icon"
                  className="h-7 w-7 rounded-none first:rounded-l-md last:rounded-r-md"
                  onClick={() => setViewport(v.id)}
                  title={v.label}
                  data-testid={`viewport-${v.id}`}
                >
                  <v.icon className="w-3.5 h-3.5" />
                </Button>
              ))}
            </div>

            <Button variant="ghost" size="icon" onClick={undo} disabled={historyIndex <= 0} data-testid="button-undo">
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={redo} disabled={historyIndex >= history.length - 1} data-testid="button-redo">
              <Redo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || isLoading || !project || !projectId}
              data-testid="button-export"
              title="Export as HTML/CSS/JS"
            >
              <Download className="w-4 h-4 mr-1" />
              {exportMutation.isPending ? "Exporting..." : "Export"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSubmitDialog(true)} data-testid="button-submit">
              <Send className="w-4 h-4 mr-1" />
              Submit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              title="Preview your website"
              onClick={() => {
                const html = buildPreviewHtml(blocks, projectData.settings || {}, project?.name || "Preview");
                setPreviewHtml(html);
                setShowPreview(true);
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </Button>
            <Link href={`/agent/${projectId}`}>
              <Button variant="default" size="sm" className="gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 border-0" title="Open AI Agent (multi-model pipeline)">
                <Sparkles className="w-3.5 h-3.5" />
                AI Agent
              </Button>
            </Link>
          </div>
        </header>

        {/* Page Tabs Bar */}
        <div className="border-b bg-card/50 px-3 py-1.5 flex items-center gap-1 shrink-0 overflow-x-auto">
          <span className="text-xs font-semibold text-muted-foreground mr-2 shrink-0">PAGES:</span>
          {projectData.pages.map((page) => (
            <div key={page.id} className="flex items-center gap-0.5 shrink-0">
              <Button
                variant={page.id === currentPageId ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-3"
                onClick={() => { setCurrentPageId(page.id); setSelectedBlockId(null); }}
                data-testid={`page-tab-${page.id}`}
              >
                <FileText className="w-3 h-3 mr-1" />
                {page.name}
                <span className="ml-1 text-[10px] opacity-60">({page.blocks.length})</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => { setRenamePageId(page.id); setRenamePageName(page.name); }}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => deletePage(page.id)}
                    disabled={projectData.pages.length <= 1}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => { setNewPageName(""); setShowAddPageDialog(true); }}
            data-testid="button-add-page"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Page
          </Button>
        </div>

        {/* Main content */}
        <div className="flex flex-1 min-h-0">
          <div className="w-64 border-r bg-card shrink-0 overflow-hidden">
            <ComponentLibrary />
          </div>

          <CanvasDropZone
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onDeleteBlock={handleDeleteBlock}
            viewport={viewport}
            settings={projectData.settings || {}}
            onAddBlock={(type: string) => {
              const newBlock = createDefaultBlock(type);
              if (type === "navbar") {
                const pageLinks = projectData.pages.map((p) => ({ label: p.name, url: pagePathToHref(p.path) }));
                newBlock.props = { ...newBlock.props, links: pageLinks };
              }
              updateCurrentPageBlocks([...blocks, newBlock]);
              setSelectedBlockId(newBlock.id);
            }}
          />

          <div className="w-80 border-l bg-card shrink-0 overflow-hidden">
            <Tabs value={rightTab} onValueChange={setRightTab} className="h-full flex flex-col">
              <TabsList className="mx-3 mt-2 shrink-0">
                <TabsTrigger value="properties" className="flex-1 gap-1 text-xs" data-testid="tab-properties">
                  <Settings className="w-3.5 h-3.5" />
                  Props
                </TabsTrigger>
                <TabsTrigger value="style" className="flex-1 gap-1 text-xs" data-testid="tab-style">
                  <Palette className="w-3.5 h-3.5" />
                  Style
                </TabsTrigger>
                <TabsTrigger value="seo" className="flex-1 gap-1 text-xs" data-testid="tab-seo">
                  <Search className="w-3.5 h-3.5" />
                  SEO
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex-1 gap-1 text-xs" data-testid="tab-ai">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI
                </TabsTrigger>
              </TabsList>
              <TabsContent value="properties" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden">
                <PropertiesPanel block={selectedBlock} onChange={handleBlockUpdate} />
              </TabsContent>
              <TabsContent value="style" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden">
                <StyleSettingsPanel settings={projectData.settings || {}} onChange={updateSettings} />
              </TabsContent>
              <TabsContent value="seo" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden">
                {currentPage && <SeoSettingsPanel page={currentPage} onChange={updatePageSeo} />}
              </TabsContent>
              <TabsContent value="ai" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden" forceMount>
                <AiPanel onApplyBlocks={handleApplyAiBlocks} onApplyBlocksToPage={handleApplyAiBlocksToPage} projectId={projectId} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit to Team</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitMutation.mutate(submitNotes);
            }}
          >
            <Textarea
              placeholder="Add any notes for the review team..."
              value={submitNotes}
              onChange={(e) => setSubmitNotes(e.target.value)}
              className="resize-none min-h-[80px]"
              data-testid="input-submit-notes"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowSubmitDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={submitMutation.isPending} data-testid="button-confirm-submit">
                {submitMutation.isPending ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Page Dialog */}
      <Dialog open={showAddPageDialog} onOpenChange={setShowAddPageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Page</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newPageName.trim()) {
                addPage(newPageName.trim());
                setShowAddPageDialog(false);
                setNewPageName("");
              }
            }}
          >
            <Input
              placeholder="Page name (e.g. About, Contact, Blog)"
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              autoFocus
              data-testid="input-page-name"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddPageDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={!newPageName.trim()} data-testid="button-create-page">
                Create Page
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 flex flex-col gap-0 overflow-hidden">
          {/* Preview toolbar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background shrink-0">
            {/* Browser dots */}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-400/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <span className="w-3 h-3 rounded-full bg-green-400/70" />
            </div>
            {/* URL bar */}
            <div className="flex-1 flex items-center gap-2 bg-muted rounded-md px-3 py-1.5 text-xs text-muted-foreground">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{project?.name ?? "Your Website"} — Live Preview</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-7 text-xs"
              onClick={() => {
                const html = buildPreviewHtml(blocks, projectData.settings || {}, project?.name || "Preview");
                setPreviewHtml(html);
              }}
              title="Refresh preview"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowPreview(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          {/* iframe */}
          {previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              className="flex-1 w-full border-0"
              title="Website Preview"
              sandbox="allow-scripts"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <Monitor className="w-12 h-12 opacity-30" />
              <p className="font-medium">Click Refresh to load preview</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rename Page Dialog */}
      <Dialog open={!!renamePageId} onOpenChange={() => setRenamePageId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Page</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (renamePageId && renamePageName.trim()) {
                renamePage(renamePageId, renamePageName.trim());
                setRenamePageId(null);
              }
            }}
          >
            <Input
              value={renamePageName}
              onChange={(e) => setRenamePageName(e.target.value)}
              autoFocus
              data-testid="input-rename-page"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setRenamePageId(null)}>Cancel</Button>
              <Button type="submit" disabled={!renamePageName.trim()} data-testid="button-rename-page">
                Rename
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
