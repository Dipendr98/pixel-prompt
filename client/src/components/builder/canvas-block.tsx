import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ComponentBlock } from "@shared/schema";
import {
  GripVertical, Trash2, LayoutTemplate, Heading, Type, MousePointer, ImageIcon, Minus,
  ArrowUpDown, Star, Square, Navigation, Footprints, ShoppingBag, DollarSign, Mail,
  Quote, GalleryHorizontal, Video, HelpCircle, BarChart3, Users, Share2, Flag,
  Timer, Newspaper, Building2, Megaphone, ShoppingCart, ChevronDown, Check,
  Play, Globe, MapPin, Phone, Clock, BookOpen, List, CreditCard, CalendarDays, LogIn,
  FolderKanban, GitBranch, Gauge, ExternalLink, Github, Code2, Palette, Cloud,
  Database, Smartphone, Settings2, Briefcase,
  Workflow, Layers, UtensilsCrossed, Calendar, GraduationCap, GitCompare, Zap, Shield, BarChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useRef, isValidElement, cloneElement } from "react";

// Maps animation names to framer-motion variants
const animationVariants: Record<string, { hidden: any; visible: any }> = {
  "fade-in": { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  "slide-up": { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } },
  "slide-down": { hidden: { opacity: 0, y: -40 }, visible: { opacity: 1, y: 0 } },
  "slide-left": { hidden: { opacity: 0, x: 40 }, visible: { opacity: 1, x: 0 } },
  "slide-right": { hidden: { opacity: 0, x: -40 }, visible: { opacity: 1, x: 0 } },
  "zoom-in": { hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1 } },
  "zoom-out": { hidden: { opacity: 0, scale: 1.2 }, visible: { opacity: 1, scale: 1 } },
  "flip": { hidden: { opacity: 0, rotateX: 90 }, visible: { opacity: 1, rotateX: 0 } },
  "bounce": { hidden: { opacity: 0, y: 60 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.5 } } },
};

const iconMap: Record<string, any> = {
  hero: LayoutTemplate, section: Square, heading: Heading, text: Type, button: MousePointer,
  image: ImageIcon, divider: Minus, spacer: ArrowUpDown, features: Star, navbar: Navigation,
  footer: Footprints, "product-card": ShoppingBag, "pricing-table": DollarSign,
  "contact-form": Mail, testimonials: Quote, gallery: GalleryHorizontal, video: Video,
  faq: HelpCircle, stats: BarChart3, team: Users, "social-links": Share2, banner: Flag,
  countdown: Timer, newsletter: Newspaper, "logo-cloud": Building2, cta: Megaphone,
  "blog-post": BookOpen, "blog-list": List, cart: ShoppingCart, "checkout-form": CreditCard,
  map: MapPin, "booking-form": CalendarDays, "login-form": LogIn,
  "project-card": FolderKanban, "experience-timeline": GitBranch, "skills-grid": Gauge,
  "process-steps": Workflow, "service-card": Layers, "menu-grid": UtensilsCrossed,
  "event-schedule": Calendar, "course-card": GraduationCap, "comparison-table": GitCompare,
};

interface CanvasBlockProps {
  block: ComponentBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function renderBlockPreview(block: ComponentBlock) {
  const props = block.props || {};
  const blockStyle: React.CSSProperties = {};
  if (block.style?.backgroundColor) blockStyle.backgroundColor = block.style.backgroundColor;
  if (block.style?.textColor) blockStyle.color = block.style.textColor;
  if (block.style?.padding) blockStyle.padding = block.style.padding;
  if (block.style?.borderRadius) blockStyle.borderRadius = block.style.borderRadius;

  // Parse customCss into the style object
  if (block.style?.customCss) {
    try {
      const cssRules = block.style.customCss.split(';').filter(Boolean);
      cssRules.forEach(rule => {
        const [key, value] = rule.split(':').map(str => str.trim());
        if (key && value) {
          const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          (blockStyle as any)[camelKey] = value;
        }
      });
    } catch (e) {
      // Ignore malformed CSS from AI
    }
  }

  const hasStyle = Object.keys(blockStyle).length > 0;

  // Helper: returns a className string that strips conflicting bg-* classes when AI style exists
  const cn = (base: string) => {
    if (!hasStyle) return base;
    return base.split(' ').filter(c => !c.startsWith('bg-') && !c.startsWith('from-') && !c.startsWith('to-')).join(' ');
  };

  const wrapStyle = (content: React.ReactNode) => {
    if (!hasStyle) return content;
    if (isValidElement(content)) {
      const baseClass = content.props.className || "";
      const newClass = typeof baseClass === 'string' ? cn(baseClass) : baseClass;
      return cloneElement(content as React.ReactElement<any>, {
        className: newClass,
        style: { ...(content.props.style || {}), ...blockStyle }
      });
    }
    return <div style={blockStyle}>{content}</div>;
  };

  switch (block.type) {
    case "hero":
      return wrapStyle(
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-md p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">{props.title || "Hero Title"}</h2>
          <p className="text-muted-foreground mb-4">{props.subtitle || "Your subtitle text goes here"}</p>
          <div className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">
            {props.buttonText || "Get Started"}
          </div>
        </div>
      );

    case "navbar":
      return wrapStyle(
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-card rounded-md border border-border">
          <span className="font-bold text-sm">{props.brand || "Brand"}</span>
          <div className="flex items-center gap-4">
            {(props.links?.length ? props.links : [{ label: "Home" }, { label: "Products" }, { label: "About" }, { label: "Contact" }]).map((l: any, i: number) => (
              <span key={i} className="text-xs text-muted-foreground">{l.label}</span>
            ))}
            {props.ctaText && (
              <span className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md">{props.ctaText}</span>
            )}
          </div>
        </div>
      );

    case "footer":
      return wrapStyle(
        <div className="bg-muted/50 rounded-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {(props.columns?.length ? props.columns : [
              { title: "Company", links: ["About", "Careers", "Blog"] },
              { title: "Support", links: ["Help Center", "Contact", "FAQ"] },
              { title: "Legal", links: ["Privacy", "Terms", "Cookies"] },
            ]).map((col: any, i: number) => (
              <div key={i}>
                <p className="text-xs font-semibold mb-2">{col.title}</p>
                {(col.links?.length ? col.links : []).map((link: string, j: number) => (
                  <p key={j} className="text-xs text-muted-foreground">{link}</p>
                ))}
              </div>
            ))}
          </div>
          <hr className="border-border mb-3" />
          <p className="text-xs text-muted-foreground text-center">{props.copyright || "2025 Your Company. All rights reserved."}</p>
        </div>
      );

    case "product-card":
      return wrapStyle(
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(props.products?.length ? props.products : [
            { name: "Product 1", price: "$29.99", description: "Amazing product", image: "" },
            { name: "Product 2", price: "$49.99", description: "Premium quality", image: "" },
            { name: "Product 3", price: "$19.99", description: "Best seller", image: "" },
          ]).map((p: any, i: number) => (
            <div key={i} className="bg-card rounded-md border border-border overflow-hidden">
              <div className="h-28 bg-muted flex items-center justify-center">
                {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : <ShoppingBag className="w-8 h-8 text-muted-foreground" />}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm font-bold text-primary">{p.price}</span>
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-md flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" /> Add
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      );

    case "pricing-table":
      return wrapStyle(
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(props.plans?.length ? props.plans : [
            { name: "Basic", price: "$9/mo", features: ["5 Products", "Basic Analytics", "Email Support"], highlighted: false },
            { name: "Pro", price: "$29/mo", features: ["Unlimited Products", "Advanced Analytics", "Priority Support", "Custom Domain"], highlighted: true },
            { name: "Enterprise", price: "$99/mo", features: ["Everything in Pro", "Dedicated Manager", "SLA", "API Access"], highlighted: false },
          ]).map((plan: any, i: number) => (
            <div key={i} className={`rounded-md border p-4 text-center ${plan.highlighted ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{plan.name}</p>
              <p className="text-2xl font-bold mt-2">{plan.price}</p>
              <div className="mt-3 space-y-1.5">
                {(plan.features?.length ? plan.features : []).map((f: string, j: number) => (
                  <p key={j} className="text-xs text-muted-foreground flex items-center gap-1.5 justify-center">
                    <Check className="w-3 h-3 text-primary shrink-0" /> {f}
                  </p>
                ))}
              </div>
              <div className={`mt-4 text-xs px-3 py-2 rounded-md font-medium ${plan.highlighted ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                Choose Plan
              </div>
            </div>
          ))}
        </div>
      );

    case "contact-form":
      return wrapStyle(
        <div className="max-w-md mx-auto bg-card rounded-md border border-border p-6">
          <h3 className="text-lg font-semibold mb-1">{props.title || "Get in Touch"}</h3>
          <p className="text-xs text-muted-foreground mb-4">{props.subtitle || "We'd love to hear from you"}</p>
          <div className="space-y-3">
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3"><span className="text-xs text-muted-foreground">Your Name</span></div>
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3"><span className="text-xs text-muted-foreground">Email Address</span></div>
            <div className="h-20 rounded-md border border-border bg-muted/30 flex items-start p-3"><span className="text-xs text-muted-foreground">Your Message</span></div>
            <div className="bg-primary text-primary-foreground text-center text-sm py-2 rounded-md font-medium">{props.buttonText || "Send Message"}</div>
          </div>
        </div>
      );

    case "testimonials":
      return wrapStyle(
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(props.testimonials?.length ? props.testimonials : [
            { name: "Sarah J.", role: "CEO", quote: "This product changed our business completely!" },
            { name: "Mike R.", role: "Designer", quote: "The best tool I've used in my career." },
            { name: "Lisa K.", role: "Developer", quote: "Incredible experience from start to finish!" },
          ]).map((t: any, i: number) => (
            <div key={i} className="bg-card rounded-md border border-border p-4">
              <Quote className="w-5 h-5 text-primary/40 mb-2" />
              <p className="text-xs text-muted-foreground italic mb-3">"{t.quote}"</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{(t.name || "A")[0]}</div>
                <div>
                  <p className="text-xs font-medium">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      );

    case "gallery":
      const galleryItems = props.images?.length ? props.images : Array.from({ length: props.count || 8 }).map(() => ({ src: "" }));
      return wrapStyle(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {galleryItems.map((img: any, i: number) => (
            <div key={i} className="aspect-square bg-muted rounded-md flex items-center justify-center overflow-hidden">
              {img.src ? <img src={img.src} alt="Gallery item" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
            </div>
          ))}
        </div>
      );

    case "video":
      return wrapStyle(
        <div className="bg-muted rounded-md flex items-center justify-center" style={{ height: props.height || "300px" }}>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Play className="w-6 h-6 text-primary ml-1" />
            </div>
            <p className="text-xs text-muted-foreground">{props.url || "Video Embed"}</p>
          </div>
        </div>
      );

    case "faq":
      return wrapStyle(
        <div className="max-w-2xl mx-auto space-y-2">
          <h3 className="text-lg font-semibold text-center mb-4">{props.title || "Frequently Asked Questions"}</h3>
          {(props.items?.length ? props.items : [
            { question: "What is your return policy?", answer: "30-day money-back guarantee." },
            { question: "How long does shipping take?", answer: "3-5 business days." },
            { question: "Do you offer support?", answer: "Yes, 24/7 via chat and email." },
          ]).map((item: any, i: number) => (
            <div key={i} className="border border-border rounded-md p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{item.question}</p>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{item.answer}</p>
            </div>
          ))}
        </div>
      );

    case "stats":
      return wrapStyle(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
          {(props.stats?.length ? props.stats : [
            { value: "10K+", label: "Customers" },
            { value: "99.9%", label: "Uptime" },
            { value: "50+", label: "Countries" },
            { value: "24/7", label: "Support" },
          ]).map((s: any, i: number) => (
            <div key={i} className="p-4">
              <p className="text-2xl font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      );

    case "team":
      return wrapStyle(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(props.members?.length ? props.members : [
            { name: "John Doe", role: "CEO", bio: "Visionary leader" },
            { name: "Jane Smith", role: "CTO", bio: "Tech innovator" },
          ]).map((m: any, i: number) => (
            <div key={i} className="text-center p-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 mx-auto mb-2 flex items-center justify-center overflow-hidden">
                {m.image ? <img src={m.image} alt={m.name} className="w-full h-full object-cover" /> : <Users className="w-6 h-6 text-primary" />}
              </div>
              <p className="text-sm font-medium">{m.name}</p>
              <p className="text-xs text-primary">{m.role}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.bio}</p>
            </div>
          ))}
        </div>
      );

    case "social-links":
      return wrapStyle(
        <div className="flex items-center justify-center gap-3 py-4">
          {(props.links?.length ? props.links : [{ platform: "Twitter" }, { platform: "Facebook" }, { platform: "Instagram" }]).map((s: any, i: number) => (
            <div key={i} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <Globe className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      );

    case "banner":
      return wrapStyle(
        <div className={`rounded-md p-4 text-center ${props.variant === "warning" ? "bg-yellow-500/10 border border-yellow-500/30" : props.variant === "error" ? "bg-destructive/10 border border-destructive/30" : "bg-primary/10 border border-primary/30"}`}>
          <p className="text-sm font-medium">{props.text || "Special offer: Get 20% off today!"}</p>
          {props.linkText && <p className="text-xs text-primary mt-1">{props.linkText}</p>}
        </div>
      );

    case "countdown":
      return wrapStyle(
        <div className="text-center py-6">
          <h3 className="text-lg font-semibold mb-4">{props.title || "Coming Soon"}</h3>
          <div className="flex items-center justify-center gap-4">
            {["Days", "Hours", "Min", "Sec"].map((unit) => (
              <div key={unit} className="bg-muted rounded-md p-3 min-w-[60px]">
                <p className="text-xl font-bold">00</p>
                <p className="text-[10px] text-muted-foreground">{unit}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">{props.subtitle || "Something amazing is on the way"}</p>
        </div>
      );

    case "newsletter":
      return wrapStyle(
        <div className="bg-primary/5 rounded-md p-6 text-center max-w-lg mx-auto">
          <h3 className="text-lg font-semibold">{props.title || "Stay Updated"}</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">{props.subtitle || "Subscribe to our newsletter"}</p>
          <div className="flex gap-2">
            <div className="flex-1 h-9 rounded-md border border-border bg-background flex items-center px-3"><span className="text-xs text-muted-foreground">Enter your email</span></div>
            <div className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md font-medium">{props.buttonText || "Subscribe"}</div>
          </div>
        </div>
      );

    case "logo-cloud":
      return wrapStyle(
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-4">{props.title || "Trusted by leading companies"}</p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {(props.logos?.length ? props.logos : ["Company A", "Company B", "Company C"]).map((name: string, i: number) => (
              <div key={i} className="bg-muted rounded-md px-4 py-2"><span className="text-xs font-medium text-muted-foreground">{name}</span></div>
            ))}
          </div>
        </div>
      );

    case "cta":
      return wrapStyle(
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-md p-8 text-center">
          <h3 className="text-xl font-bold">{props.title || "Ready to Get Started?"}</h3>
          <p className="text-sm text-muted-foreground mt-2 mb-4">{props.subtitle || "Join thousands of satisfied customers today"}</p>
          <div className="flex items-center justify-center gap-3">
            <span className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">{props.primaryButton || "Get Started"}</span>
            {props.secondaryButton && <span className="border border-border px-4 py-2 rounded-md text-sm">{props.secondaryButton}</span>}
          </div>
        </div>
      );

    // --- NEW COMPONENTS ---

    case "blog-post":
      return wrapStyle(
        <div className="bg-card rounded-md border border-border overflow-hidden">
          <div className="h-40 bg-muted flex items-center justify-center">
            {props.image ? <img src={props.image} alt={props.title} className="h-full w-full object-cover" /> : <BookOpen className="w-10 h-10 text-muted-foreground" />}
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">{props.category || "General"}</span>
              <span className="text-[10px] text-muted-foreground">{props.date || "2025-01-15"}</span>
            </div>
            <h3 className="text-lg font-semibold mb-1">{props.title || "Blog Post Title"}</h3>
            <p className="text-sm text-muted-foreground mb-3">{props.excerpt || "This is a preview of the blog post..."}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">By {props.author || "Author"}</span>
              <span className="text-xs text-primary font-medium">Read More →</span>
            </div>
          </div>
        </div>
      );

    case "blog-list":
      return wrapStyle(
        <div>
          <h3 className="text-lg font-semibold mb-4 text-center">{props.title || "Latest Posts"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(props.posts?.length ? props.posts : props.columns?.length ? props.columns : [
              { title: "Getting Started", excerpt: "Learn the basics...", author: "Sarah", date: "2025-01-15", category: "Design" },
              { title: "Top 10 Tips", excerpt: "Boost your rankings...", author: "Mike", date: "2025-01-10", category: "Marketing" },
              { title: "Online Store Guide", excerpt: "Step-by-step guide...", author: "Lisa", date: "2025-01-05", category: "E-Commerce" },
            ]).map((post: any, i: number) => (
              <div key={i} className="bg-card rounded-md border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">{post.category}</span>
                  <span className="text-[10px] text-muted-foreground">{post.date}</span>
                </div>
                <h4 className="text-sm font-semibold mb-1">{post.title}</h4>
                <p className="text-xs text-muted-foreground mb-2">{post.excerpt}</p>
                <span className="text-xs text-muted-foreground">By {post.author}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "cart":
      return wrapStyle(
        <div className="max-w-md mx-auto bg-card rounded-md border border-border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Shopping Cart</h3>
          {(props.items?.length ? props.items : [{ name: "Sample Product", price: "$29.99", quantity: 1 }]).map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center"><ShoppingBag className="w-5 h-5 text-muted-foreground" /></div>
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
              </div>
              <span className="text-sm font-bold">{item.price}</span>
            </div>
          ))}
          <div className="mt-4 flex justify-between items-center">
            <span className="font-semibold">Total:</span>
            <span className="font-bold text-lg text-primary">$29.99</span>
          </div>
          {props.showCheckout && <div className="mt-4 bg-primary text-primary-foreground text-center py-2.5 rounded-md text-sm font-medium">Proceed to Checkout</div>}
        </div>
      );

    case "checkout-form":
      return wrapStyle(
        <div className="max-w-md mx-auto bg-card rounded-md border border-border p-6">
          <h3 className="text-lg font-semibold mb-1">{props.title || "Checkout"}</h3>
          <p className="text-xs text-muted-foreground mb-4">{props.subtitle || "Complete your purchase"}</p>
          <div className="space-y-3">
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3"><span className="text-xs text-muted-foreground">Full Name</span></div>
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3"><span className="text-xs text-muted-foreground">Email Address</span></div>
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3"><span className="text-xs text-muted-foreground">Shipping Address</span></div>
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3"><CreditCard className="w-4 h-4 text-muted-foreground mr-2" /><span className="text-xs text-muted-foreground">Card Number</span></div>
            <div className="bg-primary text-primary-foreground text-center text-sm py-2.5 rounded-md font-medium">{props.buttonText || "Place Order"}</div>
          </div>
        </div>
      );

    case "map":
      return wrapStyle(
        <div className="bg-muted rounded-md flex items-center justify-center" style={{ height: props.height || "300px" }}>
          <div className="text-center">
            <MapPin className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">{props.address || "New York, NY"}</p>
            <p className="text-xs text-muted-foreground mt-1">Map Embed</p>
          </div>
        </div>
      );

    case "booking-form":
      return wrapStyle(
        <div className="max-w-md mx-auto bg-card rounded-md border border-border p-6">
          <h3 className="text-lg font-semibold mb-1">{props.title || "Book an Appointment"}</h3>
          <p className="text-xs text-muted-foreground mb-4">{props.subtitle || "Choose your preferred date and time"}</p>
          <div className="space-y-3">
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3"><span className="text-xs text-muted-foreground">Your Name</span></div>
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3"><span className="text-xs text-muted-foreground">Email Address</span></div>
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3"><CalendarDays className="w-4 h-4 text-muted-foreground mr-2" /><span className="text-xs text-muted-foreground">Preferred Date</span></div>
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3"><Clock className="w-4 h-4 text-muted-foreground mr-2" /><span className="text-xs text-muted-foreground">Preferred Time</span></div>
            <div>
              <p className="text-xs font-medium mb-2">Service</p>
              <div className="flex gap-2 flex-wrap">
                {(props.services?.length ? props.services : props.links?.length ? props.links : ["Consultation", "Session", "Meeting"]).map((s: string, i: number) => (
                  <span key={i} className="text-xs border border-border rounded-md px-3 py-1.5 cursor-pointer hover:bg-muted">{s}</span>
                ))}
              </div>
            </div>
            <div className="bg-primary text-primary-foreground text-center text-sm py-2.5 rounded-md font-medium">{props.buttonText || "Book Now"}</div>
          </div>
        </div>
      );

    case "login-form":
      return wrapStyle(
        <div className="max-w-sm mx-auto bg-card rounded-md border border-border p-6">
          <h3 className="text-lg font-semibold mb-1 text-center">{props.title || "Welcome Back"}</h3>
          <p className="text-xs text-muted-foreground mb-4 text-center">{props.subtitle || "Sign in to your account"}</p>
          <div className="space-y-3">
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3"><span className="text-xs text-muted-foreground">Email Address</span></div>
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3"><span className="text-xs text-muted-foreground">Password</span></div>
            <div className="bg-primary text-primary-foreground text-center text-sm py-2.5 rounded-md font-medium">{props.buttonText || "Sign In"}</div>
            {props.showSignup && <p className="text-xs text-center text-muted-foreground">Don't have an account? <span className="text-primary font-medium">Sign up</span></p>}
          </div>
        </div>
      );

    case "heading":
      return wrapStyle(
        <h2 className="text-xl font-bold" style={{ textAlign: props.align || "left", color: props.color }}>{props.text || "Heading Text"}</h2>
      );
    case "text":
      return wrapStyle(
        <p className="text-sm text-muted-foreground" style={{ textAlign: props.align || "left" }}>{props.text || "Lorem ipsum dolor sit amet."}</p>
      );
    case "button":
      return (
        <div style={{ textAlign: props.align || "left" }}>
          <div
            className={cn("inline-flex justify-center items-center bg-primary text-primary-foreground px-6 py-3 rounded-md text-sm font-medium w-full sm:w-auto cursor-pointer hover:opacity-90 transition-opacity")}
            style={blockStyle}
          >
            {props.text || "Click Me"}
          </div>
        </div>
      );
    case "image":
      return wrapStyle(
        <div className="bg-muted rounded-md flex items-center justify-center" style={{ height: props.height || "200px" }}>
          {props.src ? <img src={props.src} alt={props.alt || ""} className="h-full w-full object-cover rounded-md" /> : <>
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground ml-2">{props.alt || "Image placeholder"}</span>
          </>}
        </div>
      );
    case "divider":
      return <hr className="border-border" />;
    case "spacer":
      return <div style={{ height: props.height || "40px" }} className="bg-muted/30 rounded-md flex items-center justify-center"><span className="text-xs text-muted-foreground">Spacer ({props.height || "40px"})</span></div>;
    case "section":
      return wrapStyle(
        <div className="bg-muted/20 rounded-md p-6 border border-dashed border-border"><p className="text-sm text-muted-foreground text-center">{props.title || "Section Container"}</p></div>
      );
    case "features":
      return wrapStyle(
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(props.features?.length ? props.features : [{ title: "Feature 1", desc: "Description" }, { title: "Feature 2", desc: "Description" }, { title: "Feature 3", desc: "Description" }]).map((f: any, i: number) => (
            <div key={i} className="bg-muted/30 rounded-md p-4 text-center">
              <Star className="w-6 h-6 text-primary mx-auto mb-2" />
              <h4 className="text-sm font-medium">{f.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      );
    case "project-card": {
      const projects = props.projects?.length ? props.projects : [
        { title: "E-Commerce Platform", description: "A full-stack online store with React and Node.js. Features real-time inventory, payment integration, and admin dashboard.", techStack: ["React", "Node.js", "PostgreSQL", "Stripe"], liveUrl: "#", repoUrl: "#", image: "https://images.unsplash.com/photo-1557821552-17105176677c?auto=format&fit=crop&w=800&q=80" },
        { title: "AI Dashboard", description: "Analytics platform powered by machine learning. Visualizes complex data insights with interactive charts and automated reports.", techStack: ["Python", "FastAPI", "React", "TailwindCSS"], liveUrl: "#", repoUrl: "#", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80" },
        { title: "Mobile Fitness App", description: "Cross-platform workout tracking app with AI-generated plans, progress tracking, and social features for 10k+ users.", techStack: ["React Native", "Firebase", "TypeScript"], liveUrl: "#", repoUrl: "#", image: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80" },
      ];
      return wrapStyle(
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-center mb-6">{props.title || "Featured Projects"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projects.map((p: any, i: number) => (
              <div key={i} className="bg-card rounded-lg border border-border overflow-hidden group hover:border-primary/50 transition-colors">
                <div className="h-36 bg-muted overflow-hidden relative">
                  {p.image
                    ? <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center"><FolderKanban className="w-10 h-10 text-muted-foreground" /></div>
                  }
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end gap-2 p-3">
                    {p.liveUrl && p.liveUrl !== "#" && (
                      <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Live</span>
                    )}
                    {p.repoUrl && p.repoUrl !== "#" && (
                      <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-1"><Github className="w-3 h-3" /> Code</span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="text-sm font-semibold mb-1.5">{p.title}</h4>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(p.techStack || []).slice(0, 4).map((tech: string, j: number) => (
                      <span key={j} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{tech}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "experience-timeline": {
      const items = props.items?.length ? props.items : [
        { title: "Senior Full Stack Developer", company: "TechCorp Inc.", period: "Jan 2022 – Present", description: "Led development of microservices architecture serving 500k+ users. Mentored 4 junior developers and reduced deployment time by 60%." },
        { title: "Full Stack Developer", company: "StartupXYZ", period: "Mar 2020 – Dec 2021", description: "Built core product features from scratch using React and Node.js. Integrated payment systems and improved page load performance by 40%." },
        { title: "Junior Developer", company: "Digital Agency", period: "Jun 2018 – Feb 2020", description: "Developed responsive web applications for 20+ clients. Collaborated with design teams and delivered projects on time and within budget." },
      ];
      return wrapStyle(
        <div className="max-w-2xl mx-auto">
          <h3 className="text-lg font-bold text-center mb-6">{props.title || "Work Experience"}</h3>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-6">
              {items.map((item: any, i: number) => (
                <div key={i} className="relative pl-10">
                  <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background ring-2 ring-primary/30" />
                  <div className="bg-card rounded-lg border border-border p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-2">
                      <div>
                        <h4 className="text-sm font-semibold">{item.title}</h4>
                        <p className="text-xs text-primary font-medium flex items-center gap-1.5 mt-0.5">
                          <Briefcase className="w-3 h-3" /> {item.company}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-md whitespace-nowrap shrink-0">{item.period}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case "skills-grid": {
      const iconForType = (icon: string) => {
        switch (icon) {
          case "design": return <Palette className="w-4 h-4" />;
          case "cloud": return <Cloud className="w-4 h-4" />;
          case "data": return <Database className="w-4 h-4" />;
          case "mobile": return <Smartphone className="w-4 h-4" />;
          case "devops": return <Settings2 className="w-4 h-4" />;
          default: return <Code2 className="w-4 h-4" />;
        }
      };
      const skills = props.skills?.length ? props.skills : [
        { name: "React", level: 92, icon: "code" }, { name: "TypeScript", level: 88, icon: "code" },
        { name: "Node.js", level: 85, icon: "code" }, { name: "PostgreSQL", level: 80, icon: "data" },
        { name: "Docker", level: 75, icon: "devops" }, { name: "AWS", level: 72, icon: "cloud" },
        { name: "Figma", level: 70, icon: "design" }, { name: "Python", level: 78, icon: "code" },
      ];
      return wrapStyle(
        <div>
          <h3 className="text-lg font-bold text-center mb-6">{props.title || "Skills & Technologies"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {skills.map((skill: any, i: number) => (
              <div key={i} className="flex items-center gap-3 bg-card rounded-lg border border-border p-3">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  {iconForType(skill.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium truncate">{skill.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{skill.level}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, skill.level || 0))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── PROCESS STEPS (SaaS / Agency) ─────────────────────────────────────────
    case "process-steps": {
      const steps = props.steps?.length ? props.steps : [
        { stepNumber: 1, title: "Sign Up", description: "Create your free account in under 2 minutes with just your email" },
        { stepNumber: 2, title: "Configure", description: "Set up your workspace, invite your team, and connect your tools" },
        { stepNumber: 3, title: "Launch", description: "Go live and start seeing results from day one with real-time analytics" },
      ];
      return wrapStyle(
        <div>
          <h3 className="text-lg font-bold text-center mb-8">{props.title || "How It Works"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step: any, i: number) => (
              <div key={i} className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {step.stepNumber || i + 1}
                </div>
                {i < steps.length - 1 && <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-px bg-border" />}
                <h4 className="text-sm font-semibold">{step.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── SERVICE CARD (Agency / Freelancer) ────────────────────────────────────
    case "service-card": {
      const serviceIconMap: Record<string, any> = {
        palette: <Palette className="w-5 h-5" />,
        code: <Code2 className="w-5 h-5" />,
        megaphone: <Megaphone className="w-5 h-5" />,
        chart: <BarChart className="w-5 h-5" />,
        shield: <Shield className="w-5 h-5" />,
        zap: <Zap className="w-5 h-5" />,
      };
      const services = props.services?.length ? props.services : [
        { icon: "palette", title: "UI/UX Design", description: "Beautiful, user-centered interfaces that convert visitors into customers", price: "From $2,500" },
        { icon: "code", title: "Web Development", description: "Custom full-stack applications built with modern technologies", price: "From $5,000" },
        { icon: "megaphone", title: "Digital Marketing", description: "Data-driven campaigns that grow your reach and revenue", price: "From $1,500/mo" },
      ];
      return wrapStyle(
        <div>
          <h3 className="text-lg font-bold text-center mb-6">{props.title || "Our Services"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {services.map((svc: any, i: number) => (
              <div key={i} className="border border-border rounded-xl p-5 hover:border-primary/50 transition-all hover:shadow-lg bg-card group">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                  {serviceIconMap[svc.icon] || <Star className="w-5 h-5" />}
                </div>
                <h4 className="text-sm font-semibold mb-2">{svc.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{svc.description}</p>
                {svc.price && <p className="text-xs font-semibold text-primary">{svc.price}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── MENU GRID (Restaurant / Cafe) ─────────────────────────────────────────
    case "menu-grid": {
      const categories = props.categories?.length ? props.categories : [
        { name: "Starters", items: [
          { name: "Bruschetta al Pomodoro", price: "$12.99", description: "Grilled bread topped with fresh tomatoes, basil, and extra virgin olive oil" },
          { name: "Calamari Fritti", price: "$14.99", description: "Crispy fried calamari served with marinara and lemon aioli" },
        ]},
        { name: "Main Course", items: [
          { name: "Fettuccine Alfredo", price: "$18.99", description: "House-made pasta in a rich, creamy parmesan sauce" },
          { name: "Grilled Salmon", price: "$24.99", description: "Atlantic salmon with roasted vegetables and lemon butter" },
        ]},
        { name: "Desserts", items: [
          { name: "Tiramisu", price: "$10.99", description: "Classic Italian dessert with espresso-soaked ladyfingers and mascarpone" },
        ]},
      ];
      return wrapStyle(
        <div>
          <h3 className="text-lg font-bold text-center mb-6">{props.title || "Our Menu"}</h3>
          <div className="space-y-6">
            {categories.map((cat: any, ci: number) => (
              <div key={ci}>
                <h4 className="text-sm font-bold uppercase tracking-wider mb-3 border-b border-border pb-2 text-primary">{cat.name}</h4>
                <div className="space-y-3">
                  {(cat.items || []).map((item: any, ii: number) => (
                    <div key={ii} className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className="flex-1 border-b border-dotted border-border" />
                          <span className="text-sm font-bold text-primary whitespace-nowrap">{item.price}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── EVENT SCHEDULE (Conference / Event) ───────────────────────────────────
    case "event-schedule": {
      const days = props.days?.length ? props.days : [
        { date: "Day 1 — March 15, 2025", slots: [
          { time: "9:00 AM", title: "Opening Keynote", speaker: "Dr. Sarah Chen", description: "The Future of AI in Product Development" },
          { time: "10:30 AM", title: "Workshop: React Patterns", speaker: "Alex Rivera", description: "Advanced React architecture for scale" },
          { time: "1:00 PM", title: "Panel: DevOps Evolution", speaker: "Multiple Speakers", description: "CI/CD, Infrastructure as Code, and beyond" },
          { time: "3:30 PM", title: "Lightning Talks", speaker: "Community", description: "5-minute talks from attendees" },
        ]},
        { date: "Day 2 — March 16, 2025", slots: [
          { time: "9:00 AM", title: "Keynote: Design Systems", speaker: "Emma Liu", description: "Building at scale with design tokens" },
          { time: "11:00 AM", title: "Workshop: TypeScript Deep Dive", speaker: "Mike Park", description: "Advanced types and patterns" },
        ]},
      ];
      return wrapStyle(
        <div>
          <h3 className="text-lg font-bold text-center mb-6">{props.title || "Event Schedule"}</h3>
          <div className="space-y-6">
            {days.map((day: any, di: number) => (
              <div key={di}>
                <h4 className="text-sm font-bold mb-3 px-3 py-1.5 bg-primary/10 text-primary rounded-md inline-block">{day.date}</h4>
                <div className="space-y-2 ml-1">
                  {(day.slots || []).map((slot: any, si: number) => (
                    <div key={si} className="flex gap-4 items-start border-l-2 border-primary/30 pl-4 py-2 hover:border-primary transition-colors">
                      <span className="text-xs font-mono font-bold text-primary whitespace-nowrap w-16 shrink-0">{slot.time}</span>
                      <div className="flex-1">
                        <h5 className="text-sm font-semibold">{slot.title}</h5>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">{slot.speaker}</span>
                          {slot.description && <> — {slot.description}</>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── COURSE CARD (Education / Learning) ────────────────────────────────────
    case "course-card": {
      const courses = props.courses?.length ? props.courses : [
        { title: "Complete Web Development Bootcamp", instructor: "Prof. Sarah Miller", rating: 4.8, students: 12500, price: "$49.99", category: "Development", image: "https://images.unsplash.com/photo-1555099962-4199c345e5dd?auto=format&fit=crop&w=400&q=80" },
        { title: "UX Design Masterclass", instructor: "Dr. Alex Chen", rating: 4.9, students: 8200, price: "$39.99", category: "Design", image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=400&q=80" },
        { title: "Data Science with Python", instructor: "Maria Rodriguez", rating: 4.7, students: 15800, price: "$59.99", category: "Data Science", image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80" },
      ];
      return wrapStyle(
        <div>
          <h3 className="text-lg font-bold text-center mb-6">{props.title || "Popular Courses"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {courses.map((course: any, i: number) => (
              <div key={i} className="border border-border rounded-xl overflow-hidden bg-card hover:shadow-lg transition-all group">
                <div className="h-28 overflow-hidden">
                  {course.image ? (
                    <img src={course.image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <GraduationCap className="w-8 h-8 text-primary/40" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">{course.category || "Course"}</span>
                  <h4 className="text-sm font-semibold mt-2 line-clamp-2">{course.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{course.instructor}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, si) => (
                        <Star key={si} className={`w-3 h-3 ${si < Math.floor(course.rating || 0) ? "text-yellow-400 fill-yellow-400" : "text-muted"}`} />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{course.rating}</span>
                    <span className="text-[10px] text-muted-foreground">({(course.students || 0).toLocaleString()} students)</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-bold text-primary">{course.price || "Free"}</span>
                    <span className="text-[10px] font-medium px-2 py-1 bg-primary text-primary-foreground rounded-md">Enroll Now</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── COMPARISON TABLE (SaaS) ───────────────────────────────────────────────
    case "comparison-table": {
      const features = props.features?.length ? props.features : [
        "Users", "Storage", "API Access", "Custom Domain", "Priority Support", "Analytics", "SSO",
      ];
      const plans = props.plans?.length ? props.plans : [
        { name: "Starter", values: ["5", "10 GB", false, false, false, true, false] },
        { name: "Pro", values: ["Unlimited", "100 GB", true, true, true, true, false] },
        { name: "Enterprise", values: ["Unlimited", "1 TB", true, true, true, true, true] },
      ];
      return wrapStyle(
        <div>
          <h3 className="text-lg font-bold text-center mb-6">{props.title || "Compare Plans"}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Feature</th>
                  {plans.map((plan: any, pi: number) => (
                    <th key={pi} className="text-center py-3 px-3 font-semibold">{plan.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((feature: string, fi: number) => (
                  <tr key={fi} className={`border-b border-border/50 ${fi % 2 === 0 ? "bg-muted/20" : ""}`}>
                    <td className="py-2.5 px-3 font-medium">{feature}</td>
                    {plans.map((plan: any, pi: number) => {
                      const val = plan.values?.[fi];
                      return (
                        <td key={pi} className="text-center py-2.5 px-3">
                          {val === true ? (
                            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                          ) : val === false ? (
                            <Minus className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                          ) : (
                            <span className="font-medium">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    default:
      return <div className="text-sm text-muted-foreground">Unknown block type: {block.type}</div>;
  }
}

export function CanvasBlock({ block, isSelected, onSelect, onDelete }: CanvasBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = iconMap[block.type] || Square;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-md border-2 transition-colors ${isSelected ? "border-primary" : "border-transparent hover:border-border"
        } ${isDragging ? "opacity-40 z-50" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      data-testid={`canvas-block-${block.id}`}
    >
      <div className="absolute -top-3 left-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ visibility: isDragging ? "hidden" : "visible" }}>
        <div
          className="flex items-center gap-1 bg-card border rounded-md px-1.5 py-0.5 text-xs text-muted-foreground cursor-grab active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="w-3 h-3" />
          <Icon className="w-3 h-3" />
          <span className="capitalize">{block.type}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-card border"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          data-testid={`button-delete-block-${block.id}`}
        >
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      </div>
      {block.style?.animation && block.style.animation !== "none" ? (
        <motion.div
          className="p-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.3 }}
          variants={animationVariants[block.style.animation] || animationVariants["fade-in"]}
          transition={{
            duration: parseFloat(block.style.animationDuration || "0.6"),
            delay: parseFloat(block.style.animationDelay || "0"),
            ease: "easeOut",
          }}
        >
          {renderBlockPreview(block)}
        </motion.div>
      ) : (
        <div className="p-4">
          {renderBlockPreview(block)}
        </div>
      )}
    </div>
  );
}
